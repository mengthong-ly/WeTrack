# Meetings (Google Meet, Slack, reminders) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members schedule a Google Calendar event with a Meet link from WeTrack. Google emails the
invites, Slack gets the link, and a banner plus a Slack reminder appear about 1 hour before.

**Architecture:**
- Rules (time windows, Slack text, time-zone parsing, Google error mapping) are pure functions in
  `lib/meetings.ts`, unit-tested with `node --test`.
- Thin `fetch` wrappers talk to Google Calendar (`lib/google.ts`) and the Slack webhook (`lib/slack.ts`).
- Server actions in `app/actions.ts` create and cancel. A CRON_SECRET-protected route sends the
  reminders. The UI reuses DESIGN.md patterns.

**Tech Stack:** Next.js 16.4 App Router + Server Actions, Drizzle 0.45 + Postgres, Better Auth 1.7.11
(Google social provider, `linkSocial`, `getAccessToken`), Base UI shadcn, Motion, zod 4.

**Spec:** [docs/superpowers/specs/2026-10-21-meetings-google-meet-slack-design.md](../specs/2026-10-21-meetings-google-meet-slack-design.md)

## Global Constraints

- No new npm dependencies. Google and Slack calls are plain `fetch`.
- Google scope: `https://www.googleapis.com/auth/calendar.events.owned`.
- Create events with `?conferenceDataVersion=1&sendUpdates=all`, and
  `conferenceData.createRequest = { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } }`.
- Time zone: `process.env.APP_TIMEZONE ?? "Asia/Phnom_Penh"`. Times are stored as `timestamptz`.
- Banner and reminder lead time: 60 minutes. The cron runs every 5 minutes (`*/5 * * * *`).
- Roles: any member creates. Cancel is limited to the creator, owners and admins. Slack webhook
  setup is limited to owners and admins. The CEO only views, through `/r/[token]`.
- The Slack webhook must start with `https://hooks.slack.com/`. It and the Google tokens never reach
  the client or the logs.
- Sign-in stays email and password, invite-only. There is no "Sign in with Google" button.
- UI rules from `CLAUDE.md` and `DESIGN.md`:
  - Read DESIGN.md first, and load the `emil-design-eng` and `impeccable` skills.
  - Check `pnpm dlx shadcn@latest docs <component>` before building.
  - Use tokens only. No `rounded-[…]`, no raw hex.
  - Sentence-case copy with no exclamation marks.
  - Add any new pattern to DESIGN.md §4.
- Next.js 16: read the relevant guide in `node_modules/next/dist/docs/` before writing route or
  action code.
- Pure modules under `lib/*.ts` that tests import use relative `./x.ts` imports and no `@/` alias,
  because `node --test lib/*.test.ts` runs TS directly.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Google access revoked or the refresh token expired.** Create returns "Connect Google Calendar
   again" and shows the connect button, never a 500. Pinned by `googleError` tests (Task 3).
2. **End time at or before start** (for example 23:30 → 00:30 on one date). Rejected with "End time
   must be after the start." and never sent to Google. Pinned by `meetingSlot` tests (Task 1).
3. **Meet link still pending when created.** Join falls back to the calendar link, and the cron fills
   in `meet_url` later. Pinned by `bannerState`/`joinUrl` tests (Task 1).
4. **Slack down while reminding.** `reminded_at` is reset so the next run retries, and a create still
   succeeds with a warning. Checked against a local catcher in Task 6, step 5.
5. **Creator no longer has Google** when someone cancels. The meeting is cancelled in WeTrack and the
   message says to delete it in Google Calendar too. Pinned by the cancel flow in Task 5, step 4.

---

### Task 1: Meeting rules (pure)

**Files:**
- Create: `lib/meetings.ts`
- Test: `lib/meetings.test.ts`

**Interfaces:**
- Produces:
  - `LEAD_MINUTES = 60`
  - `type Slot = { startsAt: Date; endsAt: Date }`
  - `meetingSlot(date: string /* YYYY-MM-DD */, start: string /* HH:mm */, end: string, tz: string): Slot | { error: string }`
  - `zonedToUtc(date: string, time: string, tz: string): Date`
  - `type MeetingLike = { title: string; startsAt: Date; endsAt: Date; meetUrl: string | null; calendarUrl: string | null; canceledAt: Date | null }`
  - `bannerState(m: MeetingLike, now: Date): { kind: "soon"; minutes: number } | { kind: "live" } | null`
  - `joinUrl(m: MeetingLike): string | null` (meetUrl, else calendarUrl)
  - `parseEmails(raw: string): { emails: string[]; invalid: string[] }` (split on commas, spaces and
    newlines; lowercase; dedupe)
  - `formatSlot(s: Slot, tz: string): string`, for example `"Tue 21 Oct, 14:00–14:30"`
  - `slackCreated(m: MeetingLike, by: string, tz: string): string`
  - `slackReminder(m: MeetingLike, tz: string): string`
  - `slackCancelled(m: MeetingLike, by: string, tz: string): string`

- [ ] **Step 1: Write the failing tests** in `lib/meetings.test.ts` (style of `lib/digest.test.ts`):

```ts
const TZ = "Asia/Phnom_Penh"
const at = (iso: string) => new Date(iso)
const m = (over = {}) => ({ title: "Design review", startsAt: at("2026-10-21T07:00:00Z"), endsAt: at("2026-10-21T07:30:00Z"),
  meetUrl: "https://meet.google.com/abc-defg-hij", calendarUrl: "https://calendar.google.com/e/1", canceledAt: null, ...over })

test("zonedToUtc reads wall time in the zone", () => {
  assert.equal(zonedToUtc("2026-10-21", "14:00", TZ).toISOString(), "2026-10-21T07:00:00.000Z")
  assert.equal(zonedToUtc("2026-07-01", "09:00", "America/New_York").toISOString(), "2026-07-01T13:00:00.000Z") // DST
  assert.equal(zonedToUtc("2026-12-01", "09:00", "America/New_York").toISOString(), "2026-12-01T14:00:00.000Z")
})
test("meetingSlot rejects end at or before start", () => {
  assert.deepEqual(meetingSlot("2026-10-21", "23:30", "00:30", TZ), { error: "End time must be after the start." })
  assert.deepEqual(meetingSlot("2026-10-21", "14:00", "14:00", TZ), { error: "End time must be after the start." })
  assert.equal((meetingSlot("2026-10-21", "14:00", "14:30", TZ) as Slot).endsAt.toISOString(), "2026-10-21T07:30:00.000Z")
})
test("bannerState windows", () => {
  assert.equal(bannerState(m(), at("2026-10-21T05:59:00Z")), null)                        // 61 min before
  assert.deepEqual(bannerState(m(), at("2026-10-21T06:15:00Z")), { kind: "soon", minutes: 45 })
  assert.deepEqual(bannerState(m(), at("2026-10-21T07:10:00Z")), { kind: "live" })
  assert.equal(bannerState(m(), at("2026-10-21T07:30:00Z")), null)                        // ended
  assert.equal(bannerState(m({ canceledAt: at("2026-10-21T06:00:00Z") }), at("2026-10-21T06:15:00Z")), null)
})
test("joinUrl falls back to the calendar link while Meet is pending", () => {
  assert.equal(joinUrl(m({ meetUrl: null })), "https://calendar.google.com/e/1")
})
test("parseEmails lowercases, dedupes and reports bad ones", () => {
  assert.deepEqual(parseEmails("CEO@wejobskh.com, ceo@wejobskh.com\nnope"), { emails: ["ceo@wejobskh.com"], invalid: ["nope"] })
})
test("slack text", () => {
  assert.equal(slackCreated(m(), "Dara", TZ), "📅 *Design review* · Wed 21 Oct, 14:00–14:30 · scheduled by Dara · <https://meet.google.com/abc-defg-hij|Join>")
  assert.equal(slackReminder(m(), TZ), "⏰ *Design review* starts in 1 hour (14:00) · <https://meet.google.com/abc-defg-hij|Join>")
  assert.equal(slackCancelled(m(), "Dara", TZ), "✖️ *Design review* on Wed 21 Oct, 14:00 was cancelled by Dara")
})
```

- [ ] **Step 2: Run** `pnpm test`. Expected: FAIL, because `./meetings.ts` doesn't exist.
- [ ] **Step 3: Implement `lib/meetings.ts`** with the signatures above.
  - `zonedToUtc`: guess the time as UTC, read that instant's offset in `tz` with
    `Intl.DateTimeFormat(..., { timeZoneName: "longOffset" })`, subtract it, then repeat once to
    settle DST.
  - `bannerState` minutes: `Math.ceil((startsAt - now) / 60000)`. "soon" means
    `0 < minutes ≤ LEAD_MINUTES`.
  - Slack text escapes `&`, `<` and `>` in the title. The Join part is left out when `joinUrl` is null.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS (every test, including the existing ones).
- [ ] **Step 5: Commit** `feat(meetings): time, banner and Slack text rules`.

### Task 2: Schema and migration

**Files:**
- Modify: `lib/db/schema.ts` (after `digestSent`)
- Create: `drizzle/0004_*.sql` and the snapshot (generated)

**Interfaces:**
- Produces: tables `meeting` and `workspaceIntegration` matching spec §2, and
  `export type Meeting = typeof meeting.$inferSelect`.
  - `meeting.attendeeEmails`: `text("attendee_emails").array().notNull()`.
  - Index `meeting_org_start_idx` on `(organizationId, startsAt)`.
  - `meetingRelations`: `task` (one), `createdBy` (one user).

- [ ] **Step 1: Add the tables and relations.** Reuse `id()`, `orgId()` and `createdAt()`.
  `taskId` uses `onDelete: "set null"`, and so does `createdById`.
- [ ] **Step 2: Run** `pnpm db:generate`. Expected: a new `drizzle/0004_*.sql` with `CREATE TABLE "meeting"`
  and `CREATE TABLE "workspace_integration"`.
- [ ] **Step 3: Run** `pnpm db:migrate`, then `pnpm typecheck`. Expected: both exit 0.
- [ ] **Step 4: Commit** `feat(meetings): meeting and workspace_integration tables`.

### Task 3: Connect Google Calendar

**Files:**
- Modify: `lib/auth.ts`, `components/user-menu.tsx`, `app/(app)/layout.tsx`, `.env.example`, `README.md` (Google setup)
- Create: `lib/google.ts`, `components/connect-google.tsx`
- Test: `lib/meetings.test.ts` (add `googleError`)

**Interfaces:**
- Consumes: `MeetingLike`, `Slot` (Task 1).
- Produces:
  - In `lib/meetings.ts` (pure): `googleError(status: number): string`
    - 401 → `"Connect Google Calendar again."`
    - 403 → `"Google Calendar refused. Check the calendar permission and connect again."`
    - anything else → `"Google Calendar didn't accept the meeting. Try again."`
  - In `lib/meetings.ts` (client-safe): `CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.owned"`.
  - In `lib/google.ts` (`server-only`):
    - `hasCalendar(userId: string): Promise<boolean>`
    - `googleToken(userId: string): Promise<string | null>`
    - `createEvent(token: string, input: { title: string; description: string; slot: Slot; emails: string[]; tz: string }): Promise<{ id: string; meetUrl: string | null; calendarUrl: string | null } | { error: string }>`
    - `getEvent(token, id): Promise<{ meetUrl: string | null } | null>`
    - `deleteEvent(token, id): Promise<{ ok: true } | { error: string }>`
  - In `components/connect-google.tsx`: `ConnectGoogle({ className?: string })`, a button that runs
    `authClient.linkSocial({ provider: "google", scopes: [CALENDAR_SCOPE], callbackURL: location.pathname })`.

- [ ] **Step 1: Write the failing test** for `googleError(401|403|500)` with the three strings above.
  Run `pnpm test`. Expected: FAIL.
- [ ] **Step 2: Implement `googleError`.** Run `pnpm test`. Expected: PASS.
- [ ] **Step 3: Configure Better Auth** in `lib/auth.ts`:
  - `socialProviders.google` with `clientId`, `clientSecret`, `accessType: "offline"`,
    `prompt: "select_account consent"` and `disableImplicitSignUp: true`.
  - `account.accountLinking`: `{ enabled: true, allowDifferentEmails: true }`. A personal sign-up
    email may differ from the work calendar. Only a signed-in user can link, so this is safe here.
  - Leave the `user.create` invite hook as it is.
- [ ] **Step 4: Implement `lib/google.ts`.**
  - `googleToken`: find the `account` row (`providerId = "google"`, `userId`) whose `scope` contains
    `CALENDAR_SCOPE`. Call `auth.api.getAccessToken({ body: { accountId: row.id, userId } })` with
    no headers, which Better Auth 1.7.11 allows for server calls and which refreshes when needed. Any
    thrown error → `null`.
  - `createEvent`:
    - POST to `…/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`.
    - On non-2xx → `{ error: googleError(status) }`, logging the status only.
    - Meet link: `hangoutLink`, else the `entryPoints` item with `entryPointType: "video"`. If the
      `createRequest.status.statusCode` is `"pending"`, run one `getEvent` retry.
  - `deleteEvent`: `DELETE …/events/{id}?sendUpdates=all`. 404 and 410 count as `ok`.
- [ ] **Step 5: UI.**
  - The layout passes `calendarConnected = await hasCalendar(me.user.id)` to `UserMenu`.
  - The menu shows "Connect Google Calendar" (runs `ConnectGoogle`'s handler) or "Google Calendar
    connected".
  - Add `GOOGLE_CLIENT_ID=` and `GOOGLE_CLIENT_SECRET=` to `.env.example`.
  - The README gets setup steps: an OAuth web client, the redirect
    `${BETTER_AUTH_URL}/api/auth/callback/google`, the Calendar API turned on, and the consent screen
    set to Internal on Workspace. Fix the stale "Sign up … with Google" line.
- [ ] **Step 6: Verify** with `pnpm typecheck && pnpm lint`. Expected: exit 0. Then, with real keys in
  `.env.local`: connect from the user menu, then check
  `select scope from account where provider_id='google'` contains `calendar.events.owned` and
  `refresh_token is not null`. If there are no keys, note it as unverified.
- [ ] **Step 7: Commit** `feat(meetings): connect Google Calendar per person`.

### Task 4: Slack webhook setting

**Files:**
- Create: `lib/slack.ts`, `components/slack-card.tsx`
- Modify: `app/actions.ts` (new "Integrations" section), `app/(app)/team/page.tsx`

**Interfaces:**
- Produces:
  - `postSlack(orgId: string, text: string): Promise<"sent" | "skipped">`. It throws on a non-2xx.
    `"skipped"` means no webhook is set.
  - `hasSlack(orgId): Promise<boolean>`.
  - Server action `setSlackWebhook(url: string | null): Promise<Result>`. Owners and admins only, or
    it returns `"Only owners and admins can change Slack."`.
    - `null` removes the webhook.
    - A URL must match `^https://hooks\.slack\.com/`, otherwise "Paste a Slack incoming webhook URL.".
    - It POSTs `"WeTrack is connected. Meeting links and reminders will appear here."` before
      upserting. If that fails, it returns "Slack didn't accept that webhook.".
  - `SlackCard({ connected: boolean })`:
    - Connected: "Posting to Slack" with Replace and Remove (Remove goes through `confirm()`).
    - Not connected: an input plus a Connect button.
    - It never receives the URL.

- [ ] **Step 1: Implement `lib/slack.ts` and the action** (upsert with
  `onConflictDoUpdate` on `organizationId`).
- [ ] **Step 2: Add `SlackCard`** as a `Reveal` card on Team, inside `canInvite`, after "CEO link".
  Copy the `ShareLinkCard` layout.
- [ ] **Step 3: Verify** that a non-Slack URL shows the error, and that a local catcher URL is
  rejected by the prefix rule. Then, with a real webhook if one is provided, the channel gets the
  test message and the card shows "Posting to Slack". Run `pnpm typecheck && pnpm lint`. Expected:
  exit 0.
- [ ] **Step 4: Commit** `feat(meetings): Slack webhook on the Team page`.

### Task 5: Create and cancel meetings (server)

**Files:**
- Modify: `app/actions.ts`, `lib/queries.ts`, `lib/activity-text.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - `createMeeting(input: { title: string; date: string; start: string; end: string; memberIds: string[]; guests: string; taskId: string | null }): Promise<Result & { id?: string; warning?: string; needsGoogle?: true }>`
  - `cancelMeeting(id: string): Promise<Result & { warning?: string }>`
  - `upcomingMeetings(orgId: string, opts?: { email?: string; userId?: string; days?: number }): Promise<MeetingRow[]>`. It returns
    meetings that aren't cancelled and haven't ended, within `days` (default 7), sorted by start,
    with `task: { id, title }` and `createdBy: { id, name, image }`. With `email`/`userId`, it only
    returns meetings where `email = any(attendee_emails)` or `created_by_id = userId`.
  - `taskMeetings(orgId: string, taskId: string)`.
  - `export type MeetingRow`.
  - `describeActivity("meeting_scheduled")` → `"scheduled a meeting on"`.

- [ ] **Step 1: `createMeeting`.**
  - Validation: zod gives a title of 1–200 characters. Then `meetingSlot` (error passthrough).
    `startsAt` may be at most 5 minutes in the past ("Pick a time in the future.").
  - Every `memberIds` entry must pass `isMember`. Guests must give no `invalid` from `parseEmails`
    ("Check these emails: …"). With the members' own emails added, there are 1–50 emails in total.
  - `taskId` must pass `ownTask`.
  - No token → `{ error: "Connect Google Calendar first.", needsGoogle: true }`.
  - The description is `"From WeTrack: ${BETTER_AUTH_URL}/tasks/${taskId}"` when there is a task.
  - Then follow spec §3, steps 3–7. Slack errors are caught and logged, and they return
    `warning: "Meeting created, but Slack didn't get it."`.
- [ ] **Step 2: `cancelMeeting`.**
  - Find the meeting in the workspace. If it's missing or already cancelled → "Meeting not found.".
  - Allowed for the creator, owner or admin, otherwise "Only the organizer or an admin can cancel.".
  - Use the creator's `googleToken`, then `deleteEvent`.
  - If there is no token, or delete returns an error, still set `canceled_at` and return
    `warning: "Cancelled here. Delete it in Google Calendar too."`.
  - Then send `slackCancelled` (errors ignored) and `refresh()`.
- [ ] **Step 3: Queries and activity text** as in the interfaces.
- [ ] **Step 4: Verify the Review Focus #5 path**: temporarily delete the creator's Google `account`
  row in the dev DB, then cancel. Expected: the row has `canceled_at` set and the warning text comes
  back. Then run `pnpm typecheck && pnpm lint`. Expected: exit 0.
- [ ] **Step 5: Commit** `feat(meetings): create and cancel meetings with Google Meet`.

### Task 6: Reminder cron

**Files:**
- Create: `lib/cron.ts`, `app/api/cron/meetings/route.ts`, `.github/workflows/meeting-reminders.yml` (Hobby fallback, `workflow_dispatch` + `schedule: "*/5 * * * *"`, curl with `secrets.CRON_SECRET` and `vars.APP_URL`)
- Modify: `app/api/cron/digest/route.ts` (import `authorized` from `lib/cron.ts`), `vercel.ts`, `README.md`

**Interfaces:**
- Produces: `authorized(request: Request): boolean` in `lib/cron.ts` (moved without changes), and
  `GET /api/cron/meetings` → `{ reminded: number, filled: number }`, or 401.

- [ ] **Step 1: Move `authorized` and `sha`** into `lib/cron.ts`. The digest route imports them.
  Run `pnpm typecheck`. Expected: exit 0.
- [ ] **Step 2: The route.**
  - Claim due meetings with the single `UPDATE … RETURNING` from spec §5, in Drizzle
    (`isNull(remindedAt)`, `isNull(canceledAt)`, `lte(startsAt, sql\`now() + interval '60 minutes'\`)`,
    `gt(startsAt, sql\`now()\`)`).
  - For each claimed meeting with a null `meetUrl`, try `getEvent` with the creator's token and save
    it.
  - Then `postSlack(orgId, slackReminder(m, tz))`. If that throws, set `remindedAt = null` for that
    meeting.
  - Also fill `meetUrl` for unclaimed meetings that start within 24 hours and still have none. Count
    every filled link in `filled`.
- [ ] **Step 3: `vercel.ts`.** Add `{ path: "/api/cron/meetings", schedule: "*/5 * * * *" }` with a
  comment: Pro only; on Hobby, use the GitHub workflow.
- [ ] **Step 4: Verify auth.**
  - `curl -s -o /dev/null -w "%{http_code}" localhost:3100/api/cron/meetings`. Expected: `401`.
  - With `-H "Authorization: Bearer $CRON_SECRET"`. Expected: `200` and JSON.
- [ ] **Step 5: Verify retry (Review Focus #4).**
  - Insert a meeting starting in 30 minutes. Set the org's webhook directly in the DB to
    `https://hooks.slack.com/services/invalid`, then call the route. Expected:
    `reminded_at IS NULL` afterwards.
  - With a valid webhook, call it twice. Expected: one Slack message, and `reminded: 0` on the second
    call.
- [ ] **Step 6: Commit** `feat(meetings): 1-hour Slack reminder cron`.

### Task 7: New meeting dialog and entry points

**Files:**
- Create: `components/new-meeting-dialog.tsx`
- Modify: `components/task-detail.tsx` ("Schedule meeting" button), `components/command-menu.tsx` ("New meeting" action), `app/(app)/layout.tsx` (mount the dialog once and pass `calendarConnected`), `DESIGN.md` §4

**Interfaces:**
- Consumes: `createMeeting` (Task 5), `ConnectGoogle` (Task 3), `MemberLite` (`lib/options.ts`).
- Produces:
  - `NEW_MEETING_EVENT = "wetrack:new-meeting"`.
  - `openNewMeeting(prefill?: { title?: string; taskId?: string })`, which dispatches a
    `CustomEvent(NEW_MEETING_EVENT, { detail: prefill })`. This mirrors `NEW_TASK_EVENT`.
  - `NewMeetingDialog({ members: MemberLite[]; meId: string; calendarConnected: boolean })`.

- [ ] **Step 1: Read shadcn first.** Run `pnpm dlx shadcn@latest docs dialog popover` and search
  `pnpm dlx shadcn@latest search @shadcn -q "multi select"`. If a combobox or multi-select primitive
  fits, add it with `pnpm dlx shadcn@latest add <name>` and read the file. Otherwise, use a
  `Popover` of round checkboxes from DESIGN.md.
- [ ] **Step 2: Build the dialog** to the create-dialog pattern:
  - big borderless `font-light` title;
  - properties panel `Prop` rows: Date (`Calendar` in a `Popover`, single mode), Start and End
    (`Input type="time"`, step 300), People (member multi-pick, me pre-ticked), Guests (`Input`,
    placeholder "ceo@company.com, …");
  - submit "Schedule meeting" (`type="submit"`) with ⌘/Ctrl+Enter;
  - default start is the next half hour, default length 30 minutes.
  - When `!calendarConnected` (or the action returns `needsGoogle`), the panel is replaced by one
    line, "Connect Google Calendar to schedule meetings.", and `ConnectGoogle`.
  - Success → toast "Meeting scheduled" with an "Open" action (`joinUrl`). A `warning` →
    `toast.warning(warning)`. An error goes in the one-line `role="alert"` under the panel.
- [ ] **Step 3: Entry points.**
  - Task detail gets a round "Schedule meeting" button (`VideoIcon`, `aria-label`), which calls
    `openNewMeeting({ title: task.title, taskId: task.id })`.
  - ⌘K gets an Actions item "New meeting".
- [ ] **Step 4: DESIGN.md.** Add `NewMeetingDialog`, `openNewMeeting` and the member multi-pick
  pattern to the §4 table.
- [ ] **Step 5: Browser check** (`preview_start { name: "wetrack" }`):
  - Open from ⌘K and from a task, at desktop width and at 375px, in light and dark mode, keyboard
    only.
  - Expected: no horizontal scroll and no console errors. Not connected → the connect line shows.
  - End before start → the alert line reads "End time must be after the start.".
- [ ] **Step 6: Commit** `feat(meetings): schedule meeting dialog`.

### Task 8: Upcoming meetings lists and the banner

**Files:**
- Create: `components/meeting-banner.tsx`, `components/meeting-list.tsx`
- Modify: `app/(app)/layout.tsx` (banner above `{children}`), `app/(app)/page.tsx` (Home sheet), `app/(app)/tasks/[id]/page.tsx` + `components/task-detail.tsx` (meetings above comments), `app/r/[token]/page.tsx` (banner + read-only list), `DESIGN.md` §4

**Interfaces:**
- Consumes: `upcomingMeetings`, `taskMeetings`, `MeetingRow` (Task 5); `bannerState`, `joinUrl`,
  `formatSlot` (Task 1); `cancelMeeting` (Task 5).
- Produces:
  - `MeetingBanner({ meetings: BannerMeeting[] })`, a client component where
    `BannerMeeting = Pick<MeetingRow, "id" | "title" | "startsAt" | "endsAt" | "meetUrl" | "calendarUrl" | "canceledAt">`.
    The server sends dates as ISO strings and the component turns them back into `Date`.
  - `MeetingList({ meetings: MeetingRow[]; readOnly?: boolean; canCancel?: (m) => boolean; empty: React.ReactNode })`.

- [ ] **Step 1: `MeetingBanner`.**
  - A `useState(now)` with a 30-second `setInterval`. It shows meetings whose
    `bannerState(m, now)` isn't null, earliest first.
  - The text is "*Title* starts in 45 min" or "*Title* is on now", then a Join pill link
    (`target="_blank" rel="noreferrer"`), with "+N more" when there are several.
  - Surface: floating glass (`bg-card/70 ring-1 ring-foreground/5 backdrop-blur`, `rounded-tile`).
  - Motion: `AnimatePresence`, rising 12px, ease-out-expo, respecting `useReducedMotion`.
  - It renders nothing when no meeting is in its window.
  - The members' layout passes `upcomingMeetings(orgId, { email: me.user.email, userId: me.user.id, days: 1 })`.
    The CEO page passes `upcomingMeetings(link.orgId, { days: 1 })`.
- [ ] **Step 2: `MeetingList`.**
  - Rows are `rounded-row bg-muted/60`: the time (`formatSlot`, `.tabular`), the title, the task
    link, and attendee avatars when they match a member. Join is a pill. A row menu holds "Cancel
    meeting" (`variant="destructive"`, through `confirm()`), unless `readOnly`.
  - Empty state copy: "No meetings in the next 7 days. Schedule one from a task or press ⌘K."
  - Home: a `Reveal` sheet "Upcoming meetings" in the right column above "Needs attention", with a
    "New meeting" link-button that calls `openNewMeeting()`.
  - Task detail: "Meetings" above comments. It's hidden when there are none.
  - CEO page: a read-only list above "Upcoming deadlines".
- [ ] **Step 3: DESIGN.md.** Add `MeetingBanner` and `MeetingList` to §4.
- [ ] **Step 4: Browser check.**
  - Insert a meeting starting in 40 minutes with `meet_url` null.
  - Expected: the banner reads "starts in 40 min" (±1) and Join opens the calendar link. After
    1 minute it ticks down without a reload.
  - It shows on Home, on a task and on `/r/<token>`. It's gone once `canceled_at` is set.
  - Check desktop width and 375px, light and dark, and reduced motion (emulated).
- [ ] **Step 5: Commit** `feat(meetings): upcoming meetings and the 1-hour banner`.

### Task 9: Final check

- [ ] **Step 1: Run** `pnpm test && pnpm typecheck && pnpm lint`. Expected: all exit 0.
- [ ] **Step 2: Walk DESIGN.md's "Before you ship UI" checklist** over the new screens and fix
  anything it finds.
- [ ] **Step 3: Update the docs.** Add a milestone line "6. **Meetings** — …" to `docs/spec.md`, then
  commit `docs: meetings milestone`.
- [ ] **Step 4: Report what's verified and what isn't.** Real Google and Slack calls are verified only
  if the owner's keys and webhook were available.
