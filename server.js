require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { attach } = require('./middleware');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(attach);

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }), require('./routes/auth'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Something went wrong on our side' : err.message });
});

module.exports = app;
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log('ArenaX running on port ' + port));
}
