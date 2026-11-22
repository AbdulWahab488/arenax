var app = document.getElementById('app'), navEl = document.getElementById('nav');
var ME = null, LIST = [], seq = 0;
var STATUS = { open: 'Open for entry', live: 'Live now', done: 'Finished' };
var SAMPLE = { title: 'Sample bracket', status: 'live', rounds: [[{ p1: 'Ali', p2: 'Hamza', winner: 'Ali' }, { p1: 'Sara', p2: 'Bilal', winner: 'Sara' }], [{ p1: 'Ali', p2: 'Sara', winner: null }]] };

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function toast(m) { var t = document.getElementById('toast'); t.textContent = m; t.className = 'toast show'; setTimeout(function () { t.className = 'toast'; }, 2800); }
function api(method, url, body) {
  return fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Request failed'); return d; }); });
}
var isAdmin = function () { return ME && ME.role === 'admin'; };
var stCls = function (t) { return t.status === 'live' ? 'live-s' : t.status; };

function meter(t) { var s = ''; for (var i = 0; i < t.max; i++) s += '<i class="' + (i < t.players.length ? 'f' : '') + '"></i>'; return '<div class="meter">' + s + '</div><span class="mut">' + t.players.length + ' of ' + t.max + ' players</span>'; }
function row(t) {
  return '<a class="row" href="#/tournament/' + t.id + '"><div class="gm">' + esc(t.game) + '</div><div class="ti"><b>' + esc(t.title) + '</b><span class="mut">' + esc(t.date) + ', Rs ' + t.fee + ' entry</span></div>' +
    '<div class="mt">' + meter(t) + '</div><span class="st ' + stCls(t) + '">' + STATUS[t.status] + '</span><span class="btn s go">Open</span></a>';
}
function rows(list, empty) { return '<div class="rows" id="tl">' + (list.map(row).join('') || '<p class="empty">' + empty + '</p>') + '</div>'; }

function bracket(t) {
  var rs = t.rounds || [], n = rs.length;
  if (!n) return '<p class="mut">The bracket appears here once the admin starts the tournament.</p>';
  return '<div class="bracket">' + rs.map(function (r, i) {
    var nm = i === n - 1 ? 'Final' : (i === n - 2 && n > 2 ? 'Semi finals' : 'Round ' + (i + 1));
    return '<div class="round' + (i === 0 ? ' f' : '') + (i === n - 1 ? ' l' : '') + '"><h4>' + nm + '</h4><div class="ms">' + r.map(function (m, k) {
      var line = function (name, id) {
        var w = m.winner && (m.winnerId ? id === m.winnerId : name === m.winner);
        return '<div class="' + (w ? 'w' : '') + '"><span>' + esc(name || (m.bye ? 'Bye' : 'To be decided')) + '</span><span>' + (w ? 'Won' : '') + '</span></div>';
      };
      var act = (isAdmin() && m.id && m.p1Id && m.p2Id && !m.winnerId)
        ? '<div class="act"><button class="btn s ghost" data-action="result" data-mid="' + m.id + '" data-w="' + m.p1Id + '">' + esc(m.p1) + ' won</button><button class="btn s ghost" data-action="result" data-mid="' + m.id + '" data-w="' + m.p2Id + '">' + esc(m.p2) + ' won</button></div>' : '';
      return '<div class="slot ' + (k % 2 ? 'o' : 'e') + '"><div class="m">' + line(m.p1, m.p1Id) + line(m.p2, m.p2Id) + act + '</div></div>';
    }).join('') + '</div></div>';
  }).join('') + '</div>';
}

function home() {
  return api('GET', '/api/tournaments').then(function (ts) {
    LIST = ts;
    var feat = ts.filter(function (t) { return t.status === 'live'; })[0] || ts.filter(function (t) { return t.status === 'done'; })[0];
    return (feat ? api('GET', '/api/tournaments/' + feat.id) : Promise.resolve(null)).then(function (f) {
      var b = f || SAMPLE, regs = ts.reduce(function (a, t) { return a + t.players.length; }, 0);
      var cnt = function (s) { return ts.filter(function (t) { return t.status === s; }).length; };
      var up = ts.filter(function (t) { return t.status !== 'done'; }).slice(0, 4);
      return '<section class="hero"><div><h1>Every match, one bracket.</h1><p>Create tournaments, register players and track results for PUBG, FIFA, Ludo and Tekken, all in one place.</p>' +
        '<div class="actions"><a class="btn" href="#/tournaments">Find a tournament</a>' + (ME ? '' : '<a class="btn ghost" href="#/signup">Create an account</a>') + '</div></div>' +
        '<div class="board"><div class="hd"><span>' + esc(b.title) + '</span>' + (b.status === 'live' ? '<span class="live">Live</span>' : '<span>' + (f ? STATUS[b.status] : 'Preview') + '</span>') + '</div>' + bracket(b) + '</div></section>' +
        '<div class="strip"><div><b>' + ts.length + '</b><span>Tournaments</span></div><div><b>' + regs + '</b><span>Registrations</span></div><div><b>' + cnt('live') + '</b><span>Running now</span></div><div><b>' + cnt('done') + '</b><span>Champions crowned</span></div></div>' +
        '<div class="sec"><h2>Open and live now</h2><a href="#/tournaments">See all tournaments</a></div>' + rows(up, 'No tournaments are running yet. Check back soon.') +
        '<div class="sec"><h2>How it works</h2></div><div class="steps">' +
        [['Register', 'Create an account and join a tournament before it fills up.'], ['Compete', 'The bracket is drawn automatically, byes included.'], ['Climb the ranks', 'Win matches and titles to rise on the leaderboard.']].map(function (s, i) { return '<div><b>' + (i + 1) + '</b><h3 style="margin:8px 0">' + s[0] + '</h3><p class="mut" style="margin:0">' + s[1] + '</p></div>'; }).join('') + '</div>';
    });
  });
}
function list() {
  return api('GET', '/api/tournaments').then(function (ts) {
    LIST = ts;
    return '<h1 style="font-size:clamp(40px,6vw,72px)">Tournaments</h1><div class="tabs">' + ['All', 'PUBG', 'FIFA', 'Ludo', 'Tekken'].map(function (g, i) { return '<button class="tab' + (i ? '' : ' on') + '" data-action="tab" data-g="' + g + '">' + g + '</button>'; }).join('') + '</div>' + rows(ts, 'No tournaments yet.');
  });
}
function detail(id) {
  return api('GET', '/api/tournaments/' + id).then(function (t) {
    var joined = ME && t.players.some(function (p) { return p.id === ME.id; }), btns = '';
    if (t.status === 'open') {
      if (!ME) btns += '<a class="btn" href="#/login">Log in to join</a>';
      else if (joined) btns += '<span class="st">You are registered</span>';
      else if (t.players.length >= t.max) btns += '<span class="st">This tournament is full</span>';
      else btns += '<button class="btn" data-action="join" data-id="' + t.id + '">Join this tournament</button>';
      if (isAdmin()) btns += '<button class="btn ghost" data-action="start" data-id="' + t.id + '">Generate bracket</button>';
    }
    return '<a href="#/tournaments" class="mut"><b>Back to tournaments</b></a><div style="margin-top:14px"><span class="st ' + stCls(t) + '">' + esc(t.game) + ', ' + STATUS[t.status] + '</span></div><h1 style="font-size:clamp(40px,6vw,72px);margin-top:8px">' + esc(t.title) + '</h1>' +
      '<div class="facts"><div><span>Starts</span><b>' + esc(t.date) + '</b></div><div><span>Entry fee</span><b>Rs ' + t.fee + '</b></div><div><span>Players</span><b>' + t.players.length + ' of ' + t.max + '</b></div></div>' +
      (t.champion ? '<h2 style="margin-bottom:14px">Champion: ' + esc(t.champion) + '</h2>' : '') + (btns ? '<div class="actions">' + btns + '</div>' : '') +
      '<div class="sec"><h2>Bracket</h2></div>' + bracket(t) +
      '<div class="sec"><h2>Registered players</h2></div><div class="pills">' + (t.players.map(function (p) { return '<span>' + esc(p.name) + '</span>'; }).join('') || '<span class="mut" style="border:0">Nobody has registered yet.</span>') + '</div>';
  });
}
function board() {
  return api('GET', '/api/leaderboard').then(function (lb) {
    var mx = Math.max.apply(null, lb.map(function (r) { return r.points; }).concat(1));
    return '<h1 style="font-size:clamp(40px,6vw,72px)">Leaderboard</h1><p class="mut">A match win earns 3 points and a tournament title earns 10.</p><div class="tw" style="margin-top:22px"><table><tr><th>Rank</th><th>Player</th><th>Wins</th><th>Titles</th><th>Points</th></tr>' +
      (lb.map(function (r, i) { return '<tr class="' + (i < 3 && r.points ? 'top3' : '') + '"><td class="rk">' + (i + 1) + '</td><td><b>' + esc(r.name) + '</b></td><td>' + r.wins + '</td><td>' + r.titles + '</td><td><div class="pt"><i style="width:' + Math.round(r.points / mx * 90) + 'px"></i><b>' + r.points + '</b></div></td></tr>'; }).join('') || '<tr><td colspan="5" class="empty">No players yet. Create an account to be the first on the board.</td></tr>') + '</table></div>';
  });
}
function auth(signup) {
  return '<div class="auth"><div class="side"><h2>' + (signup ? 'Join the next bracket.' : 'Back to the arena.') + '</h2><p>' + (signup ? 'One account for every tournament you enter.' : 'Pick up where your last match left off.') + '</p></div>' +
    '<form data-form="' + (signup ? 'signup' : 'login') + '"><h3>' + (signup ? 'Create your account' : 'Log in') + '</h3>' + (signup ? '<label>Full name</label><input name="name" required minlength="2" maxlength="60" placeholder="Your name">' : '') +
    '<label>Email address</label><input name="email" type="email" required placeholder="you@email.com"><label>Password</label><input name="password" type="password" required minlength="8" placeholder="At least 8 characters"><br><br>' +
    '<button class="btn full">' + (signup ? 'Create account' : 'Log in') + '</button><div class="err" id="ferr"></div><p class="mut">' + (signup ? 'Already registered? <a href="#/login"><b>Log in</b></a>' : 'New to ArenaX? <a href="#/signup"><b>Create an account</b></a>') + '</p></form></div>';
}
function profile() {
  if (!ME) return '<p>Please <a href="#/login"><b>log in</b></a> to see your profile.</p>';
  return Promise.all([api('GET', '/api/leaderboard'), api('GET', '/api/tournaments')]).then(function (a) {
    var me = a[0].filter(function (r) { return r.id === ME.id; })[0] || { wins: 0, titles: 0, points: 0 };
    var mine = a[1].filter(function (t) { return t.players.some(function (p) { return p.id === ME.id; }); });
    var b = [['Tournaments', mine.length], ['Wins', me.wins], ['Titles', me.titles], ['Points', me.points]], mx = Math.max.apply(null, b.map(function (x) { return x[1]; }).concat(1));
    return '<div class="who"><div class="av">' + esc(ME.name.charAt(0).toUpperCase()) + '</div><div><h2 style="margin:0">' + esc(ME.name) + '</h2><span class="mut">' + (isAdmin() ? 'Administrator' : 'Player') + ', ' + esc(ME.email) + '</span></div></div>' +
      '<div class="strip">' + b.map(function (x) { return '<div><b>' + x[1] + '</b><span>' + x[0] + '</span></div>'; }).join('') + '</div>' +
      '<div class="cols"><div class="panel"><h3>Performance</h3>' + b.map(function (x) { return '<div class="hb"><span>' + x[0] + '</span><i style="width:' + Math.max(2, x[1] / mx * 100) + '%"></i><span>' + x[1] + '</span></div>'; }).join('') + '</div>' +
      '<div><h3>Your tournaments</h3><div class="rows" style="margin-top:12px">' + (mine.map(row).join('') || '<p class="empty">You have not joined a tournament yet. <a href="#/tournaments"><b>Find one</b></a></p>') + '</div></div></div>';
  });
}
function admin() {
  if (!isAdmin()) return '<p>This page is for administrators. <a href="#/login"><b>Log in as admin</b></a></p>';
  return api('GET', '/api/tournaments').then(function (ts) {
    var cnt = function (s) { return ts.filter(function (t) { return t.status === s; }).length; };
    return '<h1 style="font-size:clamp(40px,6vw,72px)">Admin</h1><div class="strip"><div><b>' + ts.length + '</b><span>Total tournaments</span></div><div><b>' + cnt('open') + '</b><span>Open for entry</span></div><div><b>' + cnt('live') + '</b><span>Running now</span></div><div><b>' + cnt('done') + '</b><span>Finished</span></div></div>' +
      '<div class="cols" style="margin-top:34px"><form class="panel" data-form="create"><h3>New tournament</h3><label>Title</label><input name="title" required minlength="3" maxlength="80" placeholder="Ludo Masters"><div class="two"><div><label>Game</label><select name="game"><option>PUBG</option><option>FIFA</option><option>Ludo</option><option>Tekken</option></select></div><div><label>Start date</label><input name="date" type="date" required></div></div>' +
      '<div class="two"><div><label>Max players</label><input name="max" type="number" min="2" max="64" required placeholder="8"></div><div><label>Entry fee (Rs)</label><input name="fee" type="number" min="0" placeholder="200"></div></div><br><button class="btn">Create tournament</button><div class="err" id="ferr"></div></form>' +
      '<div><h3>Manage tournaments</h3><div class="tw"><table><tr><th>Title</th><th>Players</th><th>Status</th><th></th></tr>' +
      (ts.map(function (t) { return '<tr><td><b>' + esc(t.title) + '</b></td><td>' + t.players.length + '/' + t.max + '</td><td>' + STATUS[t.status] + '</td><td><a class="btn s ghost" href="#/tournament/' + t.id + '">Open</a> <button class="btn s ghost" data-action="delete" data-id="' + t.id + '">Delete</button></td></tr>'; }).join('') || '<tr><td colspan="4" class="empty">Create your first tournament using the form.</td></tr>') + '</table></div></div></div>';
  });
}

function renderNav() {
  var h = '<a href="#/tournaments" data-r="tournaments">Tournaments</a><a href="#/leaderboard" data-r="leaderboard">Leaderboard</a>';
  if (ME) h += '<a href="#/profile" data-r="profile">My profile</a>';
  if (isAdmin()) h += '<a href="#/admin" data-r="admin">Admin</a>';
  h += ME ? '<button class="btn s ghost" data-action="logout">Log out</button>' : '<a class="btn s" href="#/login">Log in</a>';
  navEl.innerHTML = h;
}
function route() {
  var p = (location.hash.replace('#/', '') || 'home').split('/'), r = p[0], me = ++seq;
  renderNav();
  navEl.querySelectorAll('a[data-r]').forEach(function (a) { var k = a.getAttribute('data-r'); a.classList.toggle('on', k === r || (r === 'tournament' && k === 'tournaments')); });
  var V = { home: home, tournaments: list, tournament: function () { return detail(p[1]); }, leaderboard: board, login: function () { return auth(false); }, signup: function () { return auth(true); }, profile: profile, admin: admin };
  Promise.resolve((V[r] || home)()).then(function (h) { if (me !== seq) return; app.innerHTML = h; window.scrollTo(0, 0); })
    .catch(function (e) { if (me === seq) app.innerHTML = '<p class="err">' + esc(e.message) + ' <a href="#/"><b>Back to home</b></a></p>'; });
  navEl.classList.remove('open');
}
function goto(h) { if (location.hash === h) route(); else location.hash = h; }
function act(p, ok) { return p.then(function () { if (ok) toast(ok); route(); }).catch(function (e) { toast(e.message); }); }

document.addEventListener('click', function (ev) {
  var el = ev.target.closest('[data-action]'); if (!el) return;
  var a = el.getAttribute('data-action'), id = el.getAttribute('data-id');
  if (a === 'tab') {
    document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('on'); }); el.classList.add('on');
    var g = el.getAttribute('data-g'), f = LIST.filter(function (t) { return g === 'All' || t.game === g; });
    document.getElementById('tl').innerHTML = f.map(row).join('') || '<p class="empty">No ' + esc(g) + ' tournaments yet.</p>';
  } else if (a === 'logout') { api('POST', '/api/auth/logout').then(function () { ME = null; toast('You are logged out'); goto('#/'); }); }
  else if (a === 'join') act(api('POST', '/api/tournaments/' + id + '/join'), 'You are registered');
  else if (a === 'start') act(api('POST', '/api/tournaments/' + id + '/start'), 'Bracket generated');
  else if (a === 'delete') { if (confirm('Delete this tournament and its bracket?')) act(api('DELETE', '/api/tournaments/' + id), 'Tournament deleted'); }
  else if (a === 'result') act(api('POST', '/api/tournaments/matches/' + el.getAttribute('data-mid') + '/result', { winnerId: Number(el.getAttribute('data-w')) }), 'Result saved');
});
document.addEventListener('submit', function (ev) {
  var f = ev.target.closest('form[data-form]'); if (!f) return;
  ev.preventDefault();
  var kind = f.getAttribute('data-form'), d = {}, btn = f.querySelector('button'), err = document.getElementById('ferr');
  new FormData(f).forEach(function (v, k) { d[k] = v; });
  if (kind === 'create') { d.max = Number(d.max); d.fee = d.fee === '' ? 0 : Number(d.fee); }
  btn.disabled = true; if (err) err.textContent = '';
  var req = kind === 'create' ? api('POST', '/api/tournaments', d) : api('POST', '/api/auth/' + (kind === 'signup' ? 'register' : 'login'), d);
  req.then(function (res) {
    btn.disabled = false;
    if (kind === 'create') { toast('Tournament created'); f.reset(); route(); }
    else { ME = res.user; toast(kind === 'signup' ? 'Welcome to ArenaX' : 'Welcome back'); goto(isAdmin() ? '#/admin' : '#/'); }
  }).catch(function (e) { btn.disabled = false; if (err) err.textContent = e.message; else toast(e.message); });
});
document.getElementById('burger').onclick = function () { navEl.classList.toggle('open'); };
window.addEventListener('hashchange', route);
api('GET', '/api/auth/me').then(function (r) { ME = r.user; }).catch(function () {}).then(route);
