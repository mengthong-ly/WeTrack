# Meetings: Google Calendar + Meet, Slack and reminders: design

_2026-10-21 · agreed in conversation. Builds on [spec.md](../../spec.md) and
[competitive-analysis.md](../../research/competitive-analysis.md)._

## Why

Team meetings are set up outside WeTrack today, so nothing links a meeting to the task it is about,
and nobody gets a nudge before it starts. The goal: schedule a Google Meet from WeTrack, have Google
send the invitations, post the link to Slack, and warn members and the CEO when a meeting starts
within about an hour.

**Success looks like:** a member opens a task, clicks "Schedule meeting", picks a time and people,
and within seconds the attendees have a Google invite with a Meet link, Slack shows it, and an hour
before the start the banner and a Slack reminder appear.

## What competitors do (research, 2026-10-21)

- None of the tools checked creates a Meet from a work item natively.
  - Trello: Calendar Power-Up plus a one-way iCal export. Two-way Google sync is a paid third-party
    Power-Up ([Atlassian](https://www.atlassian.com/blog/development/the-big-list-of-free-trello-power-ups-for-everyone),
    [Placker](https://placker.com/trello/features/integrations/google-calendar-sync/)).
  - Jira: Marketplace apps such as
    [Start that Call](https://marketplace.atlassian.com/apps/1236910/google-meet-video-calls-meetings-for-jira).
  - ClickUp: personal two-way Google Calendar sync, but users still ask for a Meet link from a task
    ([help](https://help.clickup.com/hc/en-us/articles/6336507264663-Google-Calendar-syncing),
    [feedback](https://feedback.clickup.com/integrations/p/additional-options-for-google-calendar)).
  - Asana: not confirmed (no results).
- Trello's Slack Power-Up posts "what's due" reminders to a channel. That is the pattern copied here.
- Several sources are vendor or third-party pages. Treat their product claims as marketing.

## Decisions

| Topic | Decision |
|---|---|
| Who creates | Owners, admins and members. The CEO has no account and only *sees* meetings (share link). |
| Google account | Each person connects their own Google account. The event lands on the organizer's calendar and they host the Meet. |
| Google scope | `https://www.googleapis.com/auth/calendar.events.owned` (narrowest scope that can create events). |
| Invitations | Google sends them (`sendUpdates=all`). WeTrack sends no invite email of its own. |
| Slack | One incoming webhook per workspace, posting to one channel. Set by owners and admins on the Team page. No DMs in v1. |
| Alerts | In-app banner (members and the CEO link) plus Slack posts on create, cancel and 1 hour before. |
| Scheduler | `/api/cron/meetings` every 5 minutes. Vercel Pro: in `vercel.ts`. Hobby: a GitHub Actions schedule calls the same URL. |
| Editing | Not in v1. Cancel and create again. |
| Dependencies | None added. Google and Slack are plain `fetch` calls. |
| Time zone | Times are entered and shown in `APP_TIMEZONE` (default `Asia/Phnom_Penh`, `lib/time.ts`), stored as `timestamptz`. |

## 1. Connecting Google

- `lib/auth.ts` adds `socialProviders.google` with `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `accessType: "offline"` and `prompt: "select_account consent"`, so Google always returns a refresh
  token ([Better Auth docs](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/google.mdx)).
- Sign-in stays email and password. There is no "Sign in with Google" button. The existing
  `user.create` hook still blocks any new user who is not invited.
- A person clicks **Connect Google Calendar** (in the user menu, and inside the meeting dialog when
  they aren't connected yet). That calls `authClient.linkSocial({ provider: "google", scopes: [calendar.events.owned] })`.
  Better Auth stores the tokens in the existing `account` table (`provider_id = "google"`).
- The Google address may differ from the WeTrack address (a personal sign-up email and a work
  calendar), so account linking allows different emails for the Google provider. Check the exact
  Better Auth 1.7 option during planning.
- Server code gets a valid access token through Better Auth's `getAccessToken` (it refreshes when
  expired). If there is no Google account or the refresh fails, the action returns
  "Connect Google Calendar first" and the dialog shows the connect button.
- **Owner setup:** create a Google Cloud OAuth client (web). Redirect URI
  `${BETTER_AUTH_URL}/api/auth/callback/google`. Enable the Google Calendar API. If wejobskh.com is on
  Google Workspace, set the consent screen to **Internal** so Google skips app verification.

## 2. Data

New tables in `lib/db/schema.ts` plus one migration:

```
meeting
  id, organization_id → organization (cascade)
  task_id → task (set null), nullable
  created_by_id → user (set null)
  title text not null
  starts_at, ends_at timestamptz not null
  attendee_emails text[] not null        -- members' emails plus guests (for example the CEO)
  google_event_id text not null
  meet_url text                          -- null while Google is still creating it
  calendar_url text                      -- event htmlLink
  reminded_at timestamptz                -- set when the 1-hour Slack reminder is claimed
  canceled_at timestamptz
  created_at
  index (organization_id, starts_at)

workspace_integration
  organization_id → organization (cascade), primary key
  slack_webhook_url text
```

- Attendees are stored as emails because guests may have no account. "Invited" for a member means
  their email is in `attendee_emails`, or they created the meeting.
- The Slack webhook URL is a secret. It is never sent to the browser: the Team page only shows
  "Connected" plus a replace or remove control.

## 3. Creating and cancelling

**Dialog.** A **New meeting** dialog follows the create-dialog pattern in DESIGN.md: a big borderless
title input and a properties panel. It has a date, start and end time (native time inputs), member
attendees as a multi-pick of members, and optional guest emails. It opens from:
- Home ("Upcoming meetings" → New meeting);
- task detail ("Schedule meeting", with the title and task filled in);
- the ⌘K command menu ("New meeting").

**`createMeeting` server action** (`app/actions.ts`):
1. Check the input with zod: title, end after start, start no more than 5 minutes in the past, up to
   50 valid emails. Then `requireMember()`: any role may create. If a task is given, check it belongs
   to the workspace (`ownTask`).
2. Get the caller's Google access token, or return the "connect first" error.
3. `POST https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`
   with `summary`, `description` (link back to the task when there is one), `start` and `end`
   (`dateTime` + `timeZone: APP_TIMEZONE`), `attendees`, and
   `conferenceData.createRequest = { requestId: <uuid>, conferenceSolutionKey: { type: "hangoutsMeet" } }`.
   Without `conferenceDataVersion=1`, Google silently drops the Meet request
   ([guide](https://developers.google.com/workspace/calendar/api/guides/create-events)).
4. Read `hangoutLink` (or the video entry point in `conferenceData.entryPoints`). If the create status
   is still `pending`, fetch the event once more. If the link still isn't there, save it as null; the
   reminder cron fills it in later.
5. Insert the `meeting` row. If it has a task, log activity `meeting_scheduled` on that task.
6. Post to Slack (section 4). A Slack failure doesn't undo the meeting: the action returns
   `{ warning: "Meeting created, but Slack didn't get it." }` and the UI shows a toast.
7. `refresh()`.

If Google returns an error, nothing is saved and the user sees a short message such as "Google
Calendar didn't accept the meeting. Try again." The raw error is logged on the server.

**`cancelMeeting`**: the creator, an owner or an admin can cancel.
`DELETE …/events/{id}?sendUpdates=all` uses the *creator's* token (the event is on their calendar).
A 404 or 410 from Google counts as already deleted. Then set `canceled_at`, post "Cancelled" to
Slack, and refresh. It is confirmed with `confirm()`, following the destructive-action pattern.

## 4. Slack

- `lib/slack.ts`: `postSlack(orgId, text)` reads the webhook URL and POSTs `{ text }`. If no webhook
  is set it does nothing.
- Messages are built by pure functions in `lib/meetings.ts`, in plain Slack mrkdwn:
  - created: `📅 *Design review* · Tue 21 Oct, 14:00–14:30 · scheduled by Dara · <meet|Join>`
  - reminder: `⏰ *Design review* starts in 1 hour (14:00) · <meet|Join>`
  - cancelled: `✖️ *Design review* on Tue 21 Oct, 14:00 was cancelled by Dara`
- Owners and admins set or remove the webhook on the Team page with `setSlackWebhook`. It only
  accepts `https://hooks.slack.com/` URLs and sends a test message before saving.

## 5. Alerts

**Banner** (`components/meeting-banner.tsx`):
- Shows from `starts_at − 60 min` until `ends_at` for meetings that aren't cancelled. The text says
  "*Title* starts in 45 min · Join", and "*Title* is on now · Join" once it starts.
- Members see it at the top of every signed-in page (app layout), for meetings they are invited to or
  created. The CEO sees it on `/r/[token]`, for every meeting in the workspace.
- The server passes in today's meetings, and a client timer re-checks the window every 30 seconds, so
  the banner appears and disappears without a reload. More than one meeting stacks into
  "+1 more".
- Respects reduced motion, enters with `Reveal`, and the Join link opens in a new tab.

**Reminder cron** (`app/api/cron/meetings/route.ts`):
- Authorized like the digest: `Authorization: Bearer $CRON_SECRET`. The `authorized()` helper moves
  to `lib/cron.ts` and both routes use it.
- Claims due meetings in one statement:
  `UPDATE meeting SET reminded_at = now() WHERE reminded_at IS NULL AND canceled_at IS NULL AND starts_at <= now() + interval '60 minutes' AND starts_at > now() RETURNING …`.
  A duplicate run claims nothing, the same idea as `digest_sent`.
- Posts one Slack reminder per claimed meeting. On a Slack error it resets `reminded_at`, so the
  next run retries.
- Also fills in a missing `meet_url` by fetching the event with the creator's token.
- `vercel.ts` adds `{ path: "/api/cron/meetings", schedule: "*/5 * * * *" }` (Pro). For Hobby, the
  README documents a GitHub Actions `schedule` workflow that curls the URL with the secret.

**Lists:**
- Home gets an "Upcoming meetings" sheet: the next 7 days, each row showing time, title, task, avatars
  and Join, with a cancel item in its row menu.
- Task detail shows that task's meetings above the comments.
- The CEO link gets a read-only "Upcoming meetings" list (no cancel).

## 6. Security

- Every action re-checks the session and the workspace. Cancel also checks creator, owner or admin.
- Google tokens stay on the server, in `account`. They are never sent to the client or logged.
- The webhook URL never leaves the server. Only owners and admins can change it.
- The cron route rejects requests without the secret, using a constant-time compare.
- Meet links appear on the CEO page, which already sits behind a revocable token.

## 7. Testing

- `lib/meetings.test.ts` (`node --test`) covers:
  - banner window: before the 60-minute mark, inside it, during the meeting, after it ends, cancelled;
  - reminder due window;
  - Slack message text;
  - parsing a date and time in `APP_TIMEZONE` into a UTC instant.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`.
- Browser check of the dialog, banner, Home list and Team Slack setting at desktop width, 375px and in
  dark mode, following DESIGN.md's checklist.
- Google and Slack end to end: needs the owner's OAuth client and webhook. Until then, the Google
  calls are checked against the API docs and the Slack path against a local request catcher.

## Out of scope (v1)

- Editing a meeting (time, attendees), and syncing changes made in Google Calendar back into WeTrack.
- Slack DMs, a Slack app or bot, and choosing a channel per project.
- A CEO account or CEO-created meetings.
- Recurring meetings.
- Showing meetings on the tasks calendar view.
- Email reminders from WeTrack (Google already sends its own event reminders).
