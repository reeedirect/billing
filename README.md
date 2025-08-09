# Electricity Balance Monitoring System

A Node.js + Express + SQLite web application that monitors and records dormitory electricity balance with automatic polling, multi-user (IP–scoped) session management, and statistical analysis.

## Core Features

- Half‑hour automatic balance query.
- Manual query with global throttle (30 s shared cooldown across all users).
- Multi-user session isolation by client IP (max 5 concurrent logged-in users; oldest inactive removed when exceeding limit).
- Dual authentication:
  - Password login (auto re-auth if session expires; stored per user in session object).
  - QR code (CAS) login (requires user to re-scan when session expires).
- Session persistence across restarts (JSON files) with 7×24 h expiry:
  - user_sessions.json
  - auth_sessions.json
  - Auto save every 6 hours + on first login + graceful shutdown.
- Unified UTC+8 Time utilities (DB storage and UI display aligned).
- Rich statistics:
  - Daily min / max / avg / query count
  - Consumption deltas
  - Hourly derived consumption
  - Last automatic query endpoint
- Data backup & restore (backup tables, drop all backups, restore from selected).
- Admin controls (password-gated): delete selected rows, clear old data, backup/restore.
- Mobile responsive layout (inputs compressed to one row, stats in 2-column grid, touch-enabled range slider).
- Frontend charting & history views (daily list vs aggregated view).
- Font customization: numeric metrics rendered with a unique font.

## Technology Stack

| Layer      | Tech |
|-----------|------|
| Backend   | Node.js (Express), sqlite3 |
| Frontend  | Vanilla JS, HTML, CSS |
| Scheduling| node-cron / setInterval (half-hour + daily tasks) |
| Persistence| JSON session files + SQLite database |

## Data Model (electricity_records)

| Column            | Type        | Notes |
|-------------------|-------------|-------|
| id                | INTEGER PK  | Auto increment |
| timestamp         | DATETIME    | Default current (DB) |
| remaining_amount  | REAL        | Current balance (kWh) |
| query_time        | TEXT        | UTC+8 time string (YYYY-MM-DD HH:mm:ss) |
| is_auto           | INTEGER     | 1 = automatic, 0 = manual |

Backup tables are cloned snapshots (naming convention defined in code).

## Authentication Flow

Password Login:
1. Fetch CAS login page.
2. Parse hidden fields.
3. Submit credentials.
4. Follow redirects to electricity endpoint.
5. Persist cookies + JSESSIONID under user IP.
6. Re-auth automatically on session invalidation.

QR Login:
1. Poll CAS QR status endpoint.
2. When "success", follow redirect chain.
3. Validate electricity page (title check).
4. Store session; on invalidation prompt user to login again.

Session Validation:
- Page title inspection (detect redirect to login).
- On invalidation (password users) attempt re-auth if stored credentials exist.
- QR users are instructed to re-login.

## API (Representative)

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/query | Manual query (throttled) |
| POST | /api/password-login | Password auth |
| POST | /api/check-qrcode-login | QR poll |
| GET | /api/login-status | Per-IP login state |
| GET | /api/session-status | Auth session validity |
| POST | /api/clear-session | Invalidate current user |
| GET | /api/last-auto-query | Last auto run (UTC+8 time) |
| GET | /api/stats/today | Daily aggregate stats |
| GET | /api/stats/consumption | Detailed consumption calc |
| GET | /api/debug/sessions | Diagnostic session snapshot |
| POST | /api/backups | Create backup (if implemented) |
| GET | /api/backups | List backups |
| POST | /api/backups/restore | Restore |
| DELETE | /api/backups | Drop backups |

(Exact payloads: see server.js for current schema.)

## Rate Limiting / Scheduling

- Global manual query cooldown: 30 seconds (affects all users).
- Automatic interval: every 30 minutes (only runs once if ≥1 user logged in).
- Daily tasks (e.g. backup, summary) scheduled via cron.
- Session persistence save: every 6 hours.

## File Overview

| File | Description |
|------|-------------|
| server.js | Core server, authentication, scheduling, APIs |
| electricity.db | SQLite database |
| public/index.html | Main UI |
| public/login.html | Login UI |
| public/script.js | Frontend logic (query, charts, responsive handling) |
| public/style.css | Styles + responsive + font |
| public/xxx.ttf | Numeric display font |
| user_sessions.json | Persisted user session state |
| auth_sessions.json | Persisted auth (cookies, jsessionid) |

## Installation

```bash
git clone <repo>
cd billing
npm install
# Optional: set production mode
set NODE_ENV=production       # Windows
# or
export NODE_ENV=production    # Linux
node server.js
```

Visit: http://localhost:3000 (adjust if port auto-increments)

## PM2 Deployment (Linux / Ubuntu)

```bash
npm install -g pm2
pm2 start server.js --name billing
pm2 save
pm2 startup
pm2 restart billing
```

Ensure the working directory is writable (for session JSON + DB).

## Reverse Proxy (Nginx Example)

```
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Configuration

Edit ELECTRICITY_CONFIG in server.js:
- casLoginUrl
- electricityUrl
- building / floor / room labels (UI only)

## Mobile Optimization

- Single-row building/floor/room selectors with ellipsis overflow.
- Stats grid: 2 columns.
- Touch-enabled slider controls (drag handles responsive on narrow screens).
- Numeric font applied to key metrics only.

## Backup & Restore

Backup endpoints manipulate snapshot tables. Use admin password (handled frontend) to enable backup/restore UI. Logs track each backup operation timestamp (UTC+8 Time).

## Logging Conventions

- Manual query boundaries with timestamp markers.
- Session save / restore actions.
- Authentication stages (CAS steps labeled).
- Session invalidation reasons.

## Persistence & Expiry

- Session expiry: 7 days inactivity.
- On restart: load JSON, discard expired entries, log restored counts.
- Invalidation removes both logical & auth session entries.

## Security Notes

- Password credentials stored in session object (plain) only to support auto re-auth; consider hashing or encrypting if security context requires.
- Do not commit user_sessions.json or auth_sessions.json to public repos.
- Use HTTPS + reverse proxy in production.

## Development Tips

- Use /api/debug/sessions to inspect state.
- Add temporary console logs for deeper tracing.
- Keep font assets small for mobile performance.

## Human Contributions

- Discovered and documented the target CAS and electricity endpoints.
- Provided real operational credentials & test scenarios (password vs QR flows).
- Reported functional issues (timezone drift, multi-user contamination, session invalidation duplication).
- Defined UI layout expectations (mobile one-row selectors, stats 2-column grid, chart interactions).
- Chose numeric font and visual formatting style.
- Validated multi-user edge cases (logout / refresh / restart with persistence).
- Supplied production deployment constraints (PM2 usage, restart resilience).
- Iteratively verified fixes and clarified functional intent (e.g., shared global throttle, single auto query run).

## AI Involvement

An AI assistant (GitHub Copilot) helped:
- Refactoring authentication & session isolation (per-IP maps, persistence).
- Designing re-auth logic for password users and graceful prompts for QR users.
- Implementing UTC+8 Time normalization utilities.
- Adding session persistence (JSON) with expiry + periodic save.
- Improving error handling & log consistency.
- Enhancing responsive layout & touch slider logic.

All final behavior decisions and validation were performed by the human maintainer.

## License

Distributed under the GPLv3 License. See LICENSE for more information.