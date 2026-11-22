const router = require('express').Router();
const { query } = require('../db');
const { wrap } = require('../middleware');
// Scoring: 3 points per match won (byes excluded) and 10 per tournament title.
router.get('/', wrap(async (req, res) => {
  const users = (await query("SELECT id, name FROM users WHERE role='player'")).rows;
  const wins = (await query('SELECT winner_id AS id, count(*) AS n FROM matches WHERE is_bye=false AND winner_id IS NOT NULL GROUP BY winner_id')).rows;
  const titles = (await query('SELECT champion_id AS id, count(*) AS n FROM tournaments WHERE champion_id IS NOT NULL GROUP BY champion_id')).rows;
  const count = (rows, id) => { const r = rows.find(x => x.id === id); return r ? Number(r.n) : 0; };
  const out = users.map(u => { const w = count(wins, u.id), t = count(titles, u.id); return { id: u.id, name: u.name, wins: w, titles: t, points: w * 3 + t * 10 }; });
  out.sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
  res.json(out);
}));
module.exports = router;
