CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tournaments (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  game TEXT NOT NULL,
  starts_on DATE NOT NULL,
  max_players INTEGER NOT NULL,
  entry_fee INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  champion_id INTEGER REFERENCES users(id),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS registrations (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (tournament_id, user_id)
);
CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_no INTEGER NOT NULL,
  slot INTEGER NOT NULL,
  player1_id INTEGER REFERENCES users(id),
  player2_id INTEGER REFERENCES users(id),
  winner_id INTEGER REFERENCES users(id),
  is_bye BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (tournament_id, round_no, slot)
);
