require('dotenv').config();
const fs = require('fs'), path = require('path'), { query } = require('../db');
(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) await query(stmt);
  console.log('Database schema is ready.'); process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
