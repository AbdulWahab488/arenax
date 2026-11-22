const jwt = require('jsonwebtoken');
const { query } = require('./db');
const SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev-only-secret');
if (!SECRET) throw new Error('JWT_SECRET must be set in production');
const httpErr = (status, message) => Object.assign(new Error(message), { status });
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const sign = u => jwt.sign({ id: u.id, name: u.name, role: u.role }, SECRET, { expiresIn: '7d' });
const cookieOpts = () => ({ httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 864e5 });
function attach(req, res, next) {
  const t = req.cookies && req.cookies.token;
  if (t) { try { req.user = jwt.verify(t, SECRET); } catch (e) { /* invalid or expired */ } }
  next();
}
function requireAuth(req, res, next) { return req.user ? next() : next(httpErr(401, 'Please log in first')); }
const requireAdmin = [requireAuth, wrap(async (req, res, next) => {
  const r = await query('SELECT role FROM users WHERE id=$1', [req.user.id]); // role re-checked in DB, not trusted from token
  if (!r.rows[0] || r.rows[0].role !== 'admin') throw httpErr(403, 'Admin access required');
  next();
})];
module.exports = { httpErr, wrap, sign, cookieOpts, attach, requireAuth, requireAdmin };
