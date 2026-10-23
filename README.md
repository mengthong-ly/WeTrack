# WeTrack

Development task tracking for the WeShop team — replaces the Google Sheet with tasks, projects,
deadlines and releases, a read-only link for the CEO, and per-client update drafts.

Next.js 16 · shadcn/ui (Base UI, neutral) · Motion · Drizzle + Postgres · Better Auth.
Design decisions and milestones: [docs/spec.md](docs/spec.md).

## Run it locally

Needs Postgres on `localhost:5432` (Postgres.app) and Mailpit on `1025`/`8025` for sign-up confirmation emails.

```bash
cp .env.example .env.local        # set BETTER_AUTH_SECRET (openssl rand -base64 32); Google keys are optional
createdb wetrack
pnpm install
pnpm db:migrate
pnpm dev                          # http://localhost:3100
```

1. Sign up at `/sign-up` with Google, or with email and password and then the confirmation link (Mailpit,
   http://localhost:8025). Anyone can sign up; a new account sees nothing until it creates a team or joins one with
   a join code.
2. Create the team, then import the old sheet:

```bash
pnpm import:sheet "https://docs.google.com/spreadsheets/d/<id>/edit"
```

Rows without a client land in an **Unsorted** project — move them from each task page.

- **CEO link** — Team → CEO link → *Create link*. Copy it straight away (only a hash is stored). *Make a new link* kills the old one; *Turn off* disables it.
- **Client updates** — Projects → *N to tell the client*: tick what to report, copy the drafted message into Telegram or email, then *Mark as sent*.
- **Join code** — Team → Join code → *Create code* (owners and admins) and send it to teammates. They sign up and pick *Join a team*. Codes last 7 days and join as members; *Make a new code* kills the old one.
- **Roles** — the owner clicks a teammate's role chip on Team to make them admin or member, or remove them. Admins share the join code, CEO link and Slack; members work on projects and tasks.

Press **C** anywhere to add a task.

## Google (sign-in and calendar)

Optional. Without `GOOGLE_CLIENT_ID` the Google button and everything calendar-related stay hidden.

1. In Google Cloud, create an OAuth client of type **Web application**. Redirect URI:
   `${BETTER_AUTH_URL}/api/auth/callback/google` (locally `http://localhost:3100/api/auth/callback/google`).
2. Enable the **Google Calendar API** for the project.
3. On Google Workspace, set the OAuth consent screen to **Internal** so Google skips app verification.
4. Put the client id and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Each person then picks **Connect Google Calendar** in the account menu. WeTrack asks for
`calendar.events.owned` (events on calendars they own, not calendar settings or sharing) and only creates and
cancels the meetings it schedules. Meeting times use `APP_TIMEZONE` (default `Asia/Phnom_Penh`).

## Slack

Optional. In Slack, create an incoming webhook for the channel that should get meeting posts, then paste its URL on
**Team → Slack** (owners and admins). WeTrack posts new and cancelled meetings there, plus a reminder an hour before.

## Scripts

| | |
|---|---|
| `pnpm dev` | dev server on :3100 |
| `pnpm db:generate` | new migration from `lib/db/schema.ts` |
| `pnpm db:migrate` | apply migrations |
| `pnpm import:sheet <url>` | one-off import from the old Google Sheet (safe to re-run) |
| `pnpm test` | schedule rules (overdue / due soon / release stage) |
| `pnpm lint` · `pnpm typecheck` | |

## Staging (https://internal.weshopkh.com)

Runs on the staging droplet (`ssh wegigs-stg`, 139.59.120.180) next to WeShop and TailorOS: nginx → `server.js` on
127.0.0.1:3100 under supervisor (`wetrack-staging`), local Postgres 16 (`wetrack_staging`).

- **Deploys:** every push to `develop` (or "Run workflow") runs `.github/workflows/deploy-staging.yml`. It builds the
  standalone bundle in CI (the droplet is too small to build), uploads it, and `deploy/staging-release.sh` applies
  migrations, switches `current` and restarts. The last 5 releases stay in `/var/www/wetrack-staging/releases`.
- **Env:** `/var/www/wetrack-staging/shared/.env`, made by `deploy/staging-setup.sh`. Restart after editing:
  `sudo supervisorctl restart wetrack-staging`. Google redirect URI: `https://internal.weshopkh.com/api/auth/callback/google`.
- **Crons:** `/etc/cron.d/wetrack-staging` calls `/api/cron/meetings` every 5 minutes and `/api/cron/digest` at 08:00
  Monday Phnom Penh time.
- **Logs:** `/var/www/wetrack-staging/shared/logs/` (`app.log`, `cron.log`).
- **First-time setup:** DNS `A internal → 139.59.120.180`, then `sudo bash deploy/staging-setup.sh <deploy-key.pub>` on
  the droplet, then the repo secrets `SSH_PRIVATE_KEY` and `SSH_KNOWN_HOSTS` (`ssh-keyscan 139.59.120.180`).
