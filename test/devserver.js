// Local preview with an in-memory database (data resets on restart). Run: node test/devserver.js
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@arenax.test';
process.env.JWT_SECRET = 'dev-preview-secret';
const fs = require('fs'), path = require('path'), { newDb } = require('pg-mem'), db = require('../db');
const mem = newDb(); db.setPool(new (mem.adapters.createPg().Pool)());
for (const s of fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8').split(';').map(x => x.trim()).filter(Boolean)) mem.public.none(s);
require('../server').listen(3100, () => console.log('preview on http://localhost:3100'));
