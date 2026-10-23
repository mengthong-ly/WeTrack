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
| Editors | Small team — everyone signs in, tasks have an assignee. Open sign-up (email code or Google, no passwords); teammates join with a join code from Team. |
| CEO access | Private, revocable read-only share link (no account). _Milestone 2._ |
| Client updates | Internal checklist per project of changes not yet reported, with a drafted copy-paste message. Clients never see WeTrack. _Milestone 2._ |
| Stack | Next.js 16 App Router + Server Actions, Drizzle + Postgres, Better Auth (email OTP + organization plugin), SMTP email (Mailpit local, Resend prod), shadcn/ui neutral on Base UI, Motion. Self-hosted on the staging droplet (`deploy/`). |

## Data model

- **Better Auth**: `user`, `session`, `account`, `verification`, `organization` (the workspace), `member` (owner/admin/member), `invitation` (unused: email invites are off). `join_code`: one live code per workspace.
- **project** — a client or product (name, colour, archived). A project _is_ the client.
- **task** — project, optional release, assignee, title, description, type (development/design/bug fix), priority (urgent/normal/no rush), status (not started/in progress/review/blocked/completed), progress 0–100, start date, deadline, completed at.
- **subtask**, **comment** — per task.
- **release** — one row per version per project with staging planned/actual and production planned/actual. Release dates live only here; a task shows them through its release.
- **feedback** — one point on a task (note and/or screenshot, stored as `bytea`), author, recipient (the task's assignee when written), resolved at.
- **activity** — append-only log (task created, status changed, completed, deadline changed; releases in M3). `reported_in_update_id` null = not yet told to the client (M2).
- **client_update**, **share_link** (hashed token) — milestone 2.

Derived, never stored (`lib/schedule.ts`, unit-tested): days left, schedule health
(overdue / due soon ≤ 3 days / on track / done), release stage, effective progress (completed = 100%).

## Milestones

1. **Core** ✅ — sign-in, invite-only team, projects, tasks list + detail (sub-tasks, comments, inline editing), dashboard tiles, motion, sheet import.
2. **Reporting** ✅ — CEO share link (`/r/[token]`, read-only, filter by person; created, regenerated or turned off from Team by owners/admins); per-project client updates (`/projects/[id]/updates`: unreported changes grouped per task, drafted message, mark as sent, history).
3. **Planning** — release log UI (create/edit versions, link tasks, log release activity); timeline (week Gantt with S/P markers).
4. **Quick capture** ✅ — type "Add accessories for AsiaMode due Fri" or "Fix login #asia @dara due fri !urgent" → parsed project/assignee/deadline/priority (`lib/quick-capture.ts`, unit-tested).
5. **Team & boss views** ✅ — ⌘K command menu; Tasks search, person filter and a status board with drag and drop; project health (behind / at risk / on track); "Needs attention" (overdue, blocked, no update in 5+ days, unassigned); per-person workload on Team and the CEO link; "Done this week". Based on `docs/research/competitive-analysis.md`.
6. **Meetings** — any member schedules a Google Meet (⌘K, task page or Home) from their own Google Calendar, with the title, date, people, guests and an optional linked task; the invite goes out by Google. Owners/admins connect a Slack incoming webhook on Team; new meetings and a 1-hour reminder (cron every 5 minutes) are posted there. A banner shows the next meeting within the hour with a Join button; Home, the task page and the CEO link list upcoming meetings (Join only for invitees, the creator and admins; cancel by the creator, owners and admins). Spec: `docs/superpowers/specs/2026-10-21-meetings-google-meet-slack-design.md`.
7. **Feedback** ✅ — a Feedback tab replaces review docs: a senior picks a task, writes points and pastes screenshots; the assignee sees them under "For me" and ticks each one off when fixed.

## Security notes

- Every server action re-checks the session and that the target row belongs to the caller's workspace.
- Sign-up is open: an email and the 6-digit code sent to it (the first sign-in creates the account), or Google. Workspaces are isolated by `organizationId`, so a stranger only ever sees their own empty workspace. A signed-in user with no team sees only `/onboarding`: create a team (they become its owner) or type a join code. A code is 12 characters (2^60) from an unambiguous alphabet, lives 7 days, is stored as-is so owners can read it again, and joins as member. Roles are enforced by Better Auth (`lib/auth.ts`): only the owner can change roles or remove people; admins share the join code, CEO link and Slack; nobody can send email invites, so open sign-up can't send mail from us. Each person can create one workspace. Better Auth won't link Google to an existing account whose email isn't verified (`requireLocalEmailVerified`), so pre-registering someone's address can't take over their Google sign-in.
- Feedback screenshots are only served to members of the same workspace (`/api/feedback/[id]`, `private` cache, `nosniff`); uploads must be PNG, JPEG, WebP or GIF under 4 MB (no SVG).
- Share-link tokens are stored as sha256 hashes, shown once, one live link per workspace; the page is `noindex` and `no-referrer`.
