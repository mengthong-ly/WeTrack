import assert from "node:assert/strict"
import { test } from "node:test"

import {
  bannerState,
  CALENDAR_SCOPE,
  canJoin,
  googleError,
  joinUrl,
  meetingSlot,
  parseEmails,
  slackCancelled,
  slackCreated,
  slackMeetingCard,
  slackReminder,
  type Slot,
  zonedToUtc,
} from "./meetings.ts"

const TZ = "Asia/Phnom_Penh"
const at = (iso: string) => new Date(iso)
const m = (over = {}) => ({
  title: "Design review",
  startsAt: at("2026-10-21T07:00:00Z"),
  endsAt: at("2026-10-21T07:30:00Z"),
  meetUrl: "https://meet.google.com/abc-defg-hij",
  calendarUrl: "https://calendar.google.com/e/1",
  canceledAt: null,
  ...over,
})

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
  assert.equal(bannerState(m(), at("2026-10-21T05:59:00Z")), null) // 61 min before
  assert.deepEqual(bannerState(m(), at("2026-10-21T06:15:00Z")), { kind: "soon", minutes: 45 })
  assert.deepEqual(bannerState(m(), at("2026-10-21T07:10:00Z")), { kind: "live" })
  assert.equal(bannerState(m(), at("2026-10-21T07:30:00Z")), null) // ended
  assert.equal(bannerState(m({ canceledAt: at("2026-10-21T06:00:00Z") }), at("2026-10-21T06:15:00Z")), null)
})

test("joinUrl falls back to the calendar link while Meet is pending", () => {
  assert.equal(joinUrl(m({ meetUrl: null })), "https://calendar.google.com/e/1")
})

test("parseEmails lowercases, dedupes and reports bad ones", () => {
  assert.deepEqual(parseEmails("CEO@wejobskh.com, ceo@wejobskh.com\nnope"), {
    emails: ["ceo@wejobskh.com"],
    invalid: ["nope"],
  })
})

test("slack text", () => {
  assert.equal(
    slackCreated(m(), "Dara", TZ),
    "📅 *Design review* · Wed 21 Oct, 14:00–14:30 · scheduled by Dara · <https://meet.google.com/abc-defg-hij|Join>",
  )
  assert.equal(
    slackReminder(m(), TZ, at("2026-10-21T06:00:00Z")),
    "⏰ *Design review* starts in 1 hour (14:00) · <https://meet.google.com/abc-defg-hij|Join>",
  )
  assert.equal(
    slackReminder(m(), TZ, at("2026-10-21T06:50:00Z")),
    "⏰ *Design review* starts in 10 min (14:00) · <https://meet.google.com/abc-defg-hij|Join>",
  )
  // Never "0 min", even right at the start.
  assert.equal(
    slackReminder(m(), TZ, at("2026-10-21T07:00:00Z")),
    "⏰ *Design review* starts in 1 min (14:00) · <https://meet.google.com/abc-defg-hij|Join>",
  )
  assert.equal(slackCancelled(m(), "Dara", TZ), "✖️ *Design review* on Wed 21 Oct, 14:00 was cancelled by Dara")
})

test("slack text escapes the title and drops Join without a link", () => {
  const bare = m({ title: "A & B <c>", meetUrl: null, calendarUrl: null })
  assert.equal(slackReminder(bare, TZ, at("2026-10-21T06:00:00Z")), "⏰ *A &amp; B &lt;c&gt;* starts in 1 hour (14:00)")
})

test("googleError maps Google statuses to one line", () => {
  assert.equal(googleError(401), "Connect Google Calendar again.")
  assert.equal(googleError(403), "Google Calendar refused. Check the calendar permission and connect again.")
  assert.equal(googleError(500), "Google Calendar didn't accept the meeting. Try again.")
  assert.equal(CALENDAR_SCOPE, "https://www.googleapis.com/auth/calendar.events.owned")
})

test("canJoin: invitees, creator, owners and admins; share sees all", () => {
  const m = { createdById: "u-1", attendeeEmails: ["dara@x.test"] }
  const member = (userId: string, email: string) => ({ userId, email, role: "member" })
  assert.equal(canJoin(m, member("u-2", "dara@x.test")), true)
  assert.equal(canJoin(m, member("u-2", "Dara@X.test")), true)
  assert.equal(canJoin(m, member("u-1", "creator@x.test")), true)
  assert.equal(canJoin(m, { userId: "u-3", email: "a@x.test", role: "admin" }), true)
  assert.equal(canJoin(m, { userId: "u-4", email: "o@x.test", role: "owner" }), true)
  assert.equal(canJoin(m, member("u-5", "sok@x.test")), false)
  assert.equal(canJoin(m, "share"), true)
})

test("slack meeting card", () => {
  const card = slackMeetingCard({ ...m(), description: "Agenda:\n- Q&A <live>" }, "Dara", TZ, ["Dara", "ceo@x.com"])
  assert.equal(card.text, slackCreated(m(), "Dara", TZ))
  assert.deepEqual(card.blocks, [
    { type: "header", text: { type: "plain_text", text: "Design review" } },
    { type: "section", text: { type: "mrkdwn", text: "Agenda:\n- Q&amp;A &lt;live&gt;" } },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: "*When*\nWed 21 Oct, 14:00–14:30" },
        { type: "mrkdwn", text: "*Organizer*\nDara" },
        { type: "mrkdwn", text: "*Attendees*\nDara, ceo@x.com" },
      ],
    },
    {
      type: "actions",
      elements: [{ type: "button", text: { type: "plain_text", text: "Join meeting" }, url: "https://meet.google.com/abc-defg-hij", style: "primary" }],
    },
  ])

  // No description, no link, no attendees: those blocks drop out. Long titles fit Slack's 150-char header.
  const bare = slackMeetingCard({ ...m({ title: "x".repeat(200), meetUrl: null, calendarUrl: null }), description: null }, "Dara", TZ, [])
  assert.deepEqual(bare.blocks.map((b) => b.type), ["header", "section"])
  assert.equal((bare.blocks[0] as { text: { text: string } }).text.text, "x".repeat(149) + "…")
  assert.equal((bare.blocks[1] as { fields: unknown[] }).fields.length, 2)

  // Past six names the list ends with "+N more".
  const many = slackMeetingCard({ ...m(), description: "" }, "Dara", TZ, ["a", "b", "c", "d", "e", "f", "g", "h"])
  assert.equal((many.blocks[1] as { fields: { text: string }[] }).fields[2].text, "*Attendees*\na, b, c, d, e, f +2 more")
})
