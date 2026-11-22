# ArenaX

Online gaming tournament management system: admins create tournaments, players register,
the bracket is generated automatically (byes included), results advance winners, and a
leaderboard ranks players.

## Stack
- Frontend: HTML, CSS, vanilla JavaScript (`public/`)
- Backend: Node.js, Express
- Database: PostgreSQL (Neon in production)
- Security: bcrypt password hashing (cost 12), JWT in an httpOnly cookie, Helmet headers,
  rate-limited auth routes, parameterised SQL, server-side validation, admin role re-checked in the database

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`
3. `npm run migrate` (creates the tables)
4. `npm start` and open http://localhost:3000
5. `npm test` runs the end-to-end API tests (in-memory database, no setup needed)

The account registered with `ADMIN_EMAIL` becomes the admin.

## API
| Method | Path | Access |
|---|---|---|
| POST | /api/auth/register, /login, /logout | public |
| GET | /api/auth/me | public |
| GET | /api/tournaments, /api/tournaments/:id | public |
| POST | /api/tournaments | admin |
| POST | /api/tournaments/:id/join | player |
| POST | /api/tournaments/:id/start | admin |
| POST | /api/tournaments/matches/:id/result | admin |
| DELETE | /api/tournaments/:id | admin |
| GET | /api/leaderboard | public |
