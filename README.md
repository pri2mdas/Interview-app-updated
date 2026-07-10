# Take My Interview — DevOps Mock Interview Platform

AI-powered mock interview portal for DevOps / DevSecOps engineers. 60-minute timed sessions with an AI Staff Engineer interviewer, scenario-based questions, per-topic mastery reports.

## Stack
- **Frontend:** React 19 + Tailwind CSS, retro-futurism dark theme
- **Backend:** FastAPI + SQLite (built-in `sqlite3`)
- **Auth:** JWT (PyJWT) + bcrypt password hashing
- **LLM:** Google Gemini (`gemini-3.1-flash-lite`)

## Quick start

### Backend
```bash
cd backend
cp .env.example .env        # then fill in GEMINI_API_KEY + TMI_JWT_SECRET
pip install -r requirements.txt
python server.py            # → http://localhost:7000
```

SQLite DB lands at `backend/tmi.db` (override with `TMI_DB_PATH`). All tables are created automatically on first run.

### Frontend
```bash
cd frontend
echo 'REACT_APP_BACKEND_URL=http://localhost:7000' > .env
npm install
npm start                   # → http://localhost:3000
```

## Auth flow
- `POST /api/auth/register` — `{ email, username, full_name, password }` → `{ token, user }`
- `POST /api/auth/login` — `{ identifier (username OR email), password }` → `{ token, user }`
- `GET /api/auth/me` — returns the current user (requires `Authorization: Bearer <token>`)
- Token is stored in `localStorage` (`tmi_token`) and sent automatically on every request via an axios interceptor.

### How sessions are scoped
- When a user is logged in, `POST /api/interview/start` links the new session to `user_id`.
- `GET /api/interviews` returns **only that user's** past sessions.
- `/setup`, `/interview/:id`, `/report/:id`, `/history` are all wrapped in a `<RequireAuth>` guard — unauthenticated users get redirected to `/login` and bounced back after login.
- Anonymous (no token) sessions still work for backwards compat but are not persisted to SQLite.

## Required env vars
| Var | Purpose |
|-----|---------|
| `GEMINI_API_KEY` | LLM + voice transcription |
| `TMI_JWT_SECRET` | Signs JWTs (set explicitly, otherwise tokens invalidate on every restart) |
| `TMI_TOKEN_TTL_HOURS` | Token lifetime, default `168` (7 days) |
| `TMI_DB_PATH` | SQLite file path, default `./tmi.db` |
| `CORS_ORIGINS` | Comma-separated allowed origins |

## Theme
Retro-futurism / Swiss high-contrast terminal aesthetic.
- Bg: `zinc-950` · Surface: `zinc-900` · Border: `zinc-800`
- Primary: `green-500`/`green-400`
- Headings: Outfit · Body/data: JetBrains Mono
- Defined in `design_guidelines.json` and `frontend/tailwind.config.js`.

## Folder layout
```
backend/
  server.py           # FastAPI app + all routes
  database.py         # SQLite layer (users + interviews tables)
  auth.py             # bcrypt + JWT + auth deps
  .env.example
frontend/src/
  App.js              # routes + RequireAuth guard
  lib/
    api.js            # axios + JWT interceptor
    auth.jsx          # AuthProvider + useAuth hook
    theme.jsx         # dark/light theme provider
  pages/
    Landing.jsx       # public homepage (CTA gated)
    Login.jsx
    Register.jsx
    Setup.jsx
    Interview.jsx
    Report.jsx
    History.jsx       # scoped to logged-in user
  components/
    Nav.jsx           # login/register in corner OR user dropdown
```
