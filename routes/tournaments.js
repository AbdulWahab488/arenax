const router = require('express').Router();
const { query, tx } = require('../db');
const { httpErr, wrap, requireAuth, requireAdmin } = require('../middleware');
const { build } = require('../lib/bracket');
const GAMES = ['PUBG', 'FIFA', 'Ludo', 'Tekken'];
const day = v => (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10);
const idOf = v => { const n = Number(v); if (!Number.isInteger(n) || n < 1) throw httpErr(400, 'Invalid id'); return n; };

const shape = (t, players, rounds) => ({ id: t.id, title: t.title, game: t.game, date: day(t.starts_on), max: t.max_players, fee: t.entry_fee, status: t.status, champion: t.champion || null, players, rounds });
const T_SQL = 'SELECT t.*, c.name AS champion FROM tournaments t LEFT JOIN users c ON c.id = t.champion_id';

async function roundsOf(tid) {
  const { rows } = await query(`SELECT m.id, m.round_no, m.is_bye, m.player1_id, m.player2_id, m.winner_id, u1.name AS p1, u2.name AS p2, uw.name AS w
    FROM matches m LEFT JOIN users u1 ON u1.id=m.player1_id LEFT JOIN users u2 ON u2.id=m.player2_id LEFT JOIN users uw ON uw.id=m.winner_id
    WHERE m.tournament_id=$1 ORDER BY m.round_no, m.slot`, [tid]);
  const out = [];
  rows.forEach(m => (out[m.round_no] = out[m.round_no] || []).push({ id: m.id, bye: m.is_bye, p1: m.p1, p2: m.p2, p1Id: m.player1_id, p2Id: m.player2_id, winner: m.w, winnerId: m.winner_id }));
  return out;
}
async function full(id) {
  const t = (await query(T_SQL + ' WHERE t.id=$1', [id])).rows[0];
  if (!t) throw httpErr(404, 'Tournament not found');
  const players = (await query('SELECT u.id, u.name FROM registrations r JOIN users u ON u.id=r.user_id WHERE r.tournament_id=$1 ORDER BY r.id', [id])).rows;
  return shape(t, players, await roundsOf(id));
}

router.get('/', wrap(async (req, res) => {
  const ts = (await query(T_SQL + ' ORDER BY t.starts_on, t.id')).rows;
  const regs = (await query('SELECT r.tournament_id, u.id, u.name FROM registrations r JOIN users u ON u.id=r.user_id ORDER BY r.id')).rows;
  res.json(ts.map(t => shape(t, regs.filter(r => r.tournament_id === t.id).map(r => ({ id: r.id, name: r.name })), [])));
}));

router.get('/:id', wrap(async (req, res) => res.json(await full(idOf(req.params.id)))));

router.post('/', requireAdmin, wrap(async (req, res) => {
  const b = req.body, title = String(b.title || '').trim(), game = String(b.game || ''), date = String(b.date || '');
  const max = Number(b.max), fee = b.fee === '' || b.fee == null ? 0 : Number(b.fee);
  if (title.length < 3 || title.length > 80) throw httpErr(400, 'Title must be 3 to 80 characters');
  if (!GAMES.includes(game)) throw httpErr(400, 'Choose one of: ' + GAMES.join(', '));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date))) throw httpErr(400, 'Enter a valid start date');
  if (!Number.isInteger(max) || max < 2 || max > 64) throw httpErr(400, 'Max players must be between 2 and 64');
  if (!Number.isInteger(fee) || fee < 0 || fee > 100000) throw httpErr(400, 'Entry fee must be between 0 and 100000');
  const r = await query('INSERT INTO tournaments(title,game,starts_on,max_players,entry_fee,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id', [title, game, date, max, fee, req.user.id]);
  res.status(201).json(await full(r.rows[0].id));
}));

router.post('/:id/join', requireAuth, wrap(async (req, res) => {
  const id = idOf(req.params.id);
  const t = (await query('SELECT * FROM tournaments WHERE id=$1', [id])).rows[0];
  if (!t) throw httpErr(404, 'Tournament not found');
  if (t.status !== 'open') throw httpErr(409, 'Registration is closed for this tournament');
  const n = Number((await query('SELECT count(*) AS c FROM registrations WHERE tournament_id=$1', [id])).rows[0].c);
  if (n >= t.max_players) throw httpErr(409, 'This tournament is full');
  try { await query('INSERT INTO registrations(tournament_id,user_id) VALUES($1,$2)', [id, req.user.id]); }
  catch (e) { if (e.code === '23505') throw httpErr(409, 'You are already registered'); throw e; }
  res.json(await full(id));
}));

router.post('/:id/start', requireAdmin, wrap(async (req, res) => {
  const id = idOf(req.params.id);
  await tx(async db => {
    const t = (await db.query('SELECT * FROM tournaments WHERE id=$1', [id])).rows[0];
    if (!t) throw httpErr(404, 'Tournament not found');
    if (t.status !== 'open') throw httpErr(409, 'This tournament has already started');
    const ps = (await db.query('SELECT user_id FROM registrations WHERE tournament_id=$1', [id])).rows.map(r => r.user_id);
    if (ps.length < 2) throw httpErr(409, 'At least 2 players must register before the bracket can be generated');
    const rounds = build(ps);
    for (let r = 0; r < rounds.length; r++) for (let s = 0; s < rounds[r].length; s++) {
      const m = rounds[r][s];
      await db.query('INSERT INTO matches(tournament_id,round_no,slot,player1_id,player2_id,winner_id,is_bye) VALUES($1,$2,$3,$4,$5,$6,$7)', [id, r, s, m.p1, m.p2, m.winner || null, !!m.bye]);
    }
    await db.query("UPDATE tournaments SET status='live' WHERE id=$1", [id]);
  });
  res.json(await full(id));
}));

router.post('/matches/:mid/result', requireAdmin, wrap(async (req, res) => {
  const mid = idOf(req.params.mid), w = Number(req.body.winnerId);
  let tid;
  await tx(async db => {
    const m = (await db.query('SELECT * FROM matches WHERE id=$1', [mid])).rows[0];
    if (!m) throw httpErr(404, 'Match not found');
    if (!m.player1_id || !m.player2_id) throw httpErr(409, 'This match is not ready yet');
    if (m.winner_id) throw httpErr(409, 'A result is already recorded for this match');
    if (w !== m.player1_id && w !== m.player2_id) throw httpErr(400, 'Winner must be one of the two players');
    tid = m.tournament_id;
    await db.query('UPDATE matches SET winner_id=$1 WHERE id=$2', [w, mid]);
    const last = Number((await db.query('SELECT max(round_no) AS r FROM matches WHERE tournament_id=$1', [tid])).rows[0].r);
    if (m.round_no === last) await db.query("UPDATE tournaments SET champion_id=$1, status='done' WHERE id=$2", [w, tid]);
    else await db.query(`UPDATE matches SET ${m.slot % 2 === 0 ? 'player1_id' : 'player2_id'}=$1 WHERE tournament_id=$2 AND round_no=$3 AND slot=$4`, [w, tid, m.round_no + 1, m.slot >> 1]);
  });
  res.json(await full(tid));
}));

router.delete('/:id', requireAdmin, wrap(async (req, res) => {
  await query('DELETE FROM tournaments WHERE id=$1', [idOf(req.params.id)]);
  res.json({ ok: true });
}));

module.exports = router;
