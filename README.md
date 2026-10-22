# WeTrack

Development task tracking for the WeShop team — replaces the Google Sheet with tasks, projects,
deadlines and releases, a read-only link for the CEO, and per-client update drafts.

Next.js 16 · shadcn/ui (Base UI, neutral) · Motion · Drizzle + Postgres · Better Auth.
Design decisions and milestones: [docs/spec.md](docs/spec.md).

## Run it locally

Needs Postgres on `localhost:5432` (Postgres.app) and Mailpit on `1025`/`8025` for sign-up confirmation and invite emails.

```bash
cp .env.example .env.local        # set BETTER_AUTH_SECRET (openssl rand -base64 32); Google keys are optional
createdb wetrack
pnpm install
pnpm db:migrate
pnpm dev                          # http://localhost:3100
```

1. Sign up at `/sign-up` with Google, or with email and password and then the confirmation link (Mailpit,
   http://localhost:8025). Anyone can sign up; a new account either joins a team that invited its email or creates
   its own workspace.
2. Name the workspace, then import the old sheet:

```bash
pnpm import:sheet "https://docs.google.com/spreadsheets/d/<id>/edit"
```

Rows without a client land in an **Unsorted** project — move them from each task page.

- **CEO link** — Team → CEO link → *Create link*. Copy it straight away (only a hash is stored). *Make a new link* kills the old one; *Turn off* disables it.
- **Client updates** — Projects → *N to tell the client*: tick what to report, copy the drafted message into Telegram or email, then *Mark as sent*.
Invite teammates from **Team**; locally the email shows up in Mailpit (http://localhost:8025).

Press **C** anywhere to add a task.

## Scripts

| | |
|---|---|
| `pnpm dev` | dev server on :3100 |
| `pnpm db:generate` | new migration from `lib/db/schema.ts` |
| `pnpm db:migrate` | apply migrations |
| `pnpm import:sheet <url>` | one-off import from the old Google Sheet (safe to re-run) |
| `pnpm test` | schedule rules (overdue / due soon / release stage) |
| `pnpm lint` · `pnpm typecheck` | |

## Production (Vercel)

Neon Postgres via the Vercel Marketplace (`DATABASE_URL`), `BETTER_AUTH_URL` = the deployed URL, `GOOGLE_CLIENT_ID`/`SECRET` with
`<BETTER_AUTH_URL>/api/auth/callback/google` as the redirect URI,
email through Resend's SMTP (`SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`,
`SMTP_PASS=<api key>`). Run `pnpm db:migrate` against the production database before the first deploy.
