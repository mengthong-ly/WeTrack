# WeTrack — design spec

_2026-10-19 · agreed in conversation, built from milestone 1._

## Why

The Google Sheet tracker is slow to update and hard for the CEO to read. WeTrack replaces it with a
calm, animated web app (inspired by soft, rounded mobile task apps) that answers: what is each person
working on, for which client, when is it due, and when does it reach staging and production.

## Decisions

| Topic | Decision |
|---|---|
| Data | Own Postgres database; WeTrack fully replaces the sheet (one-off import script). |
| Editors | Small team — everyone signs in, tasks have an assignee. Invite-only after the first owner. |
| CEO access | Private, revocable read-only share link (no account). _Milestone 2._ |
| Client updates | Internal checklist per project of changes not yet reported, with a drafted copy-paste message. Clients never see WeTrack. _Milestone 2._ |
| Stack | Next.js 16 App Router + Server Actions, Drizzle + Postgres (Neon in prod), Better Auth (email/password + organization plugin), SMTP email (Mailpit local, Resend prod), shadcn/ui neutral on Base UI, Motion. Vercel. |

## Data model

- **Better Auth**: `user`, `session`, `account`, `verification`, `organization` (the workspace), `member` (owner/admin/member), `invitation`.
- **project** — a client or product (name, colour, archived). A project _is_ the client.
- **task** — project, optional release, assignee, title, description, type (development/design/bug fix), priority (urgent/normal/no rush), status (not started/in progress/review/blocked/completed), progress 0–100, start date, deadline, completed at.
- **subtask**, **comment** — per task.
- **release** — one row per version per project with staging planned/actual and production planned/actual. Release dates live only here; a task shows them through its release.
- **activity** — append-only log (task created, status changed, completed, deadline changed; releases in M3). `reported_in_update_id` null = not yet told to the client (M2).
- **client_update**, **share_link** (hashed token) — milestone 2.

Derived, never stored (`lib/schedule.ts`, unit-tested): days left, schedule health
(overdue / due soon ≤ 3 days / on track / done), release stage, effective progress (completed = 100%).

## Milestones

1. **Core** ✅ — sign-in, invite-only team, projects, tasks list + detail (sub-tasks, comments, inline editing), dashboard tiles, motion, sheet import.
2. **Reporting** — CEO share link page; client-update checklist + drafted message + history.
3. **Planning** — release log UI (create/edit versions, link tasks, log release activity); timeline (week Gantt with S/P markers).
4. **Quick capture** — type "Add accessories for AsiaMode due Fri" → parsed project/deadline/priority.

## Security notes

- Every server action re-checks the session and that the target row belongs to the caller's workspace.
- Sign-up must prove it came from the right link (`lib/auth.ts`): the first account needs the server's `SETUP_TOKEN`; everyone else needs the invite id from their email, matched to a pending, unexpired invitation for that address.
- Share-link tokens will be stored hashed (M2).
