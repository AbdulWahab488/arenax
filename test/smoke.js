// End-to-end smoke test using an in-memory PostgreSQL (pg-mem). Run: npm test
process.env.ADMIN_EMAIL = 'admin@arenax.test';
process.env.JWT_SECRET = 'test-secret';
const fs = require('fs'), path = require('path');
const { newDb } = require('pg-mem');
const db = require('../db');
const mem = newDb();
const { Pool } = mem.adapters.createPg();
db.setPool(new Pool());
for (const s of fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8').split(';').map(x => x.trim()).filter(Boolean)) mem.public.none(s);

let pass = 0, fail = 0;
const ok = (c, msg) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + msg); };
class Client {
  constructor(base) { this.base = base; this.cookie = ''; }
  async call(method, url, body) {
    const r = await fetch(this.base + url, { method, headers: { 'Content-Type': 'application/json', Cookie: this.cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.getSetCookie && r.headers.getSetCookie()[0];
    if (sc) this.cookie = sc.split(';')[0];
    return { status: r.status, data: await r.json().catch(() => null) };
  }
}

(async () => {
  const srv = require('../server').listen(0);
  const base = 'http://127.0.0.1:' + srv.address().port;
  const admin = new Client(base), anon = new Client(base);
  const players = ['Ali', 'Sara', 'Bilal', 'Hira', 'Usman'].map(() => new Client(base));
  const names = ['Ali', 'Sara', 'Bilal', 'Hira', 'Usman'];

  let r = await admin.call('POST', '/api/auth/register', { name: 'Admin', email: 'admin@arenax.test', password: 'strongpass1' });
  ok(r.status === 201 && r.data.user.role === 'admin', 'admin email gets admin role');
  r = await anon.call('POST', '/api/auth/register', { name: 'X', email: 'bad', password: '123' });
  ok(r.status === 400, 'invalid signup rejected');
  for (let i = 0; i < 5; i++) {
    r = await players[i].call('POST', '/api/auth/register', { name: names[i], email: names[i].toLowerCase() + '@mail.com', password: 'playerpass' + i });
    if (i === 0) ok(r.status === 201 && r.data.user.role === 'player', 'player signup works');
  }
  r = await anon.call('POST', '/api/auth/register', { name: 'Ali Two', email: 'ALI@mail.com', password: 'playerpass9' });
  ok(r.status === 409, 'duplicate email rejected (case-insensitive)');
  const row = (await db.query("SELECT password_hash FROM users WHERE email='ali@mail.com'")).rows[0];
  ok(/^\$2[aby]\$12\$/.test(row.password_hash) && !row.password_hash.includes('playerpass0'), 'password stored as bcrypt hash');
  r = await anon.call('POST', '/api/auth/login', { email: 'ali@mail.com', password: 'wrongpass1' });
  ok(r.status === 401, 'wrong password rejected');
  r = await anon.call('POST', '/api/auth/login', { email: 'ali@mail.com', password: 'playerpass0' });
  ok(r.status === 200, 'login works');
  r = await anon.call('GET', '/api/auth/me');
  ok(r.data.user && r.data.user.name === 'Ali', 'session cookie identifies user');

  r = await players[0].call('POST', '/api/tournaments', { title: 'Test Cup', game: 'FIFA', date: '2026-12-01', max: 8, fee: 100 });
  ok(r.status === 403, 'player cannot create tournament');
  r = await anon.call('POST', '/api/tournaments/1/join');
  r = await new Client(base).call('POST', '/api/tournaments/1/join');
  ok(r.status === 401, 'joining requires login');
  r = await admin.call('POST', '/api/tournaments', { title: 'FIFA Cup', game: 'FIFA', date: '2026-12-01', max: 8, fee: 100 });
  ok(r.status === 201 && r.data.id === 1 && r.data.date === '2026-12-01', 'admin creates tournament');
  r = await admin.call('POST', '/api/tournaments', { title: 'x', game: 'Chess', date: 'nope', max: 1 });
  ok(r.status === 400, 'tournament validation works');

  for (const p of players) await p.call('POST', '/api/tournaments/1/join');
  r = await players[0].call('POST', '/api/tournaments/1/join');
  ok(r.status === 409, 'cannot join twice');
  r = await players[0].call('POST', '/api/tournaments/1/start');
  ok(r.status === 403, 'player cannot start bracket');
  r = await admin.call('POST', '/api/tournaments/1/start');
  ok(r.status === 200 && r.data.status === 'live' && r.data.rounds.length === 3, '5 players: bracket has 3 rounds');
  ok(r.data.rounds[0].filter(m => m.bye).length === 3, '5 players: 3 byes in round 1');
  r = await admin.call('POST', '/api/tournaments/1/join');
  ok(r.status === 409, 'registration closes after start');

  // play every playable match until a champion exists
  let t = (await admin.call('GET', '/api/tournaments/1')).data, guard = 0;
  while (t.status === 'live' && guard++ < 20) {
    const m = t.rounds.flat().find(x => x.p1Id && x.p2Id && !x.winnerId);
    if (!m) break;
    r = await admin.call('POST', '/api/tournaments/matches/' + m.id + '/result', { winnerId: m.p1Id });
    t = r.data;
  }
  ok(t.status === 'done' && !!t.champion, 'tournament finishes with a champion: ' + t.champion);
  r = await admin.call('POST', '/api/tournaments/matches/' + t.rounds[0][3].id + '/result', { winnerId: 999 });
  ok(r.status === 409 || r.status === 400, 'cannot overwrite a finished match');

  r = await anon.call('GET', '/api/leaderboard');
  const champ = r.data.find(x => x.name === t.champion);
  ok(r.data.length === 5 && r.data[0].titles === 1 && champ.points >= 10, 'leaderboard ranks champion first');
  console.log(r.data.map(x => `  ${x.name}: ${x.points} pts`).join('\n'));
  r = await anon.call('GET', '/api/nothing');
  ok(r.status === 404, 'unknown API route returns 404 JSON');
  r = await admin.call('DELETE', '/api/tournaments/1');
  ok(r.status === 200, 'admin can delete tournament');

  console.log(`\n${pass} passed, ${fail} failed`);
  srv.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(1); });
