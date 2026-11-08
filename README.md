# IPL Auction Arena

Real-time multiplayer IPL auction for up to 10 friends. Node.js + Express + Socket.IO + PostgreSQL. The server is authoritative for bids, timers, purses and ownership.

## Run locally
```
npm install
npm start          # http://localhost:3000
```
Without `DATABASE_URL` rooms live in memory only. To persist, set `DATABASE_URL` in a `.env`-style environment (see `.env.example`).

## Deploy on Render (beginner guide)

### 1. Put the code on GitHub
1. Sign in at github.com, click **New repository**, name it `ipl-auction-arena`, keep it Public or Private, click **Create**.
2. On the new repo page click **uploading an existing file**.
3. Unzip the project and drag in **everything inside the folder**: `client/`, `server/`, `package.json`, `render.yaml`, `.env.example`, `.gitignore`, `README.md`. (On a phone, use a file manager to unzip first; if folders won't upload, use github.dev on a laptop.)
4. Never upload: `node_modules/`, `.env` (secrets). `.gitignore` already excludes them.
5. Click **Commit changes**.

### 2. Deploy with the Blueprint (easiest)
1. Sign in at render.com with GitHub.
2. **New +** → **Blueprint** → pick your repo → **Apply**.
3. Render creates the web service **and** a free PostgreSQL database from `render.yaml` and links `DATABASE_URL` automatically.
4. Wait for status **Live**, then open the `https://….onrender.com` URL.

### Manual setup (alternative)
- **New + → PostgreSQL** (Free). Copy its **Internal Database URL**.
- **New + → Web Service** → your repo. Runtime **Node**, Build Command `npm install`, Start Command `npm start`, Health Check Path `/healthz`.
- Environment variable: `DATABASE_URL` = the Internal Database URL. (`PORT` is set by Render.) The schema is created automatically on first boot.

WebSockets work on Render with no extra setup.

### 3. Verify multiplayer
1. Open the URL on your phone → enter a name → **Create Private Room**.
2. Open the invite link (**Copy invite link**) in a second browser/phone, enter a name, pick a different team.
3. Host picks a team and taps **Start Auction**. Bid from both devices; both screens should show the same bid and timer reset.
4. Refresh the host's page: the host role and team persist.

### Free-tier notes
- Free web services sleep after ~15 min idle (first load takes ~30–60 s). Open the site before game night.
- Free Render Postgres databases expire after a limited period; upgrade or recreate if needed. Rooms older than 24 h are cleaned up.
- If the server restarts mid-auction, the current player resumes **paused**; the host taps Resume.

## How the game works
- Starting purse ₹100 Cr, squad max 15, 7 s timer reset on every valid bid. The host can change all of these (plus bid steps) in the lobby.
- First bid is at base price; later bids add the chosen step. Stale/double-tap bids are rejected (each bid carries the bid it was based on).
- Host-only: start, pause, resume, skip, mark unsold, next, unsold round, restart, end, kick, transfer host. Identity uses a persistent token, not the socket ID.
- If the host stays disconnected 30 s, host passes to a connected player.
- Anyone can join as a spectator after the auction starts (room cap 10 people).
- Results page lists squads, spend, priciest buys, unsold players and downloads a CSV.

## Player data
`server/players.json` holds 74 real players (name, nationality, birth year, role, batting/bowling style, base price). Ages are computed from birth year.
- `photo` is empty by default: I could not verify image URLs offline, and hotlinked photos often break or are not licensed. Add an `https` URL per player (or via the host's "Add custom player" form); a clean initials avatar shows whenever a photo is missing or fails to load.
- `ipl` (team history) is empty rather than guessed. No ratings exist anywhere in the data.
- Team "logos" are colour badges with the franchise abbreviation, not official trademarked logos. Replace `logo()` in `client/js/app.js` with `<img>` tags if you have licensed assets.

## Structure
```
client/  index.html, css/style.css, js/app.js
server/  server.js (REST + sockets + engine), db.js, schema.sql, players.json, teams.json
render.yaml  package.json  .env.example  .gitignore
```
