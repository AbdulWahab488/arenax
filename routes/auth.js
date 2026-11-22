const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { httpErr, wrap, sign, cookieOpts } = require('../middleware');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pub = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });

router.post('/register', wrap(async (req, res) => {
  const name = String(req.body.name || '').trim(), email = String(req.body.email || '').trim().toLowerCase(), password = String(req.body.password || '');
  if (name.length < 2 || name.length > 60) throw httpErr(400, 'Name must be 2 to 60 characters');
  if (!EMAIL.test(email)) throw httpErr(400, 'Enter a valid email address');
  if (password.length < 8 || password.length > 72) throw httpErr(400, 'Password must be 8 to 72 characters');
  const hash = await bcrypt.hash(password, 12);
  const role = process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL.toLowerCase() ? 'admin' : 'player';
  let u;
  try { u = (await query('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role', [name, email, hash, role])).rows[0]; }
  catch (e) { if (e.code === '23505') throw httpErr(409, 'An account with this email already exists'); throw e; }
  res.cookie('token', sign(u), cookieOpts()).status(201).json({ user: pub(u) });
}));

router.post('/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase(), password = String(req.body.password || '');
  const u = (await query('SELECT * FROM users WHERE email=$1', [email])).rows[0];
  const ok = u && await bcrypt.compare(password, u.password_hash);
  if (!ok) throw httpErr(401, 'Incorrect email or password');
  res.cookie('token', sign(u), cookieOpts()).json({ user: pub(u) });
}));

router.post('/logout', (req, res) => res.clearCookie('token', cookieOpts()).json({ ok: true }));

router.get('/me', wrap(async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const u = (await query('SELECT id,name,email,role FROM users WHERE id=$1', [req.user.id])).rows[0];
  res.json({ user: u || null });
}));

module.exports = router;
