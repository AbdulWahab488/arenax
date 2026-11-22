const { Pool, types } = require('pg');
types.setTypeParser(1082, v => v); // keep DATE as 'YYYY-MM-DD' (no timezone shifts)
let pool;
function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    pool = new Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  }
  return pool;
}
const setPool = p => { pool = p; };
const query = (text, params) => getPool().query(text, params);
async function tx(fn) {
  const c = await getPool().connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); }
}
module.exports = { query, tx, setPool };
