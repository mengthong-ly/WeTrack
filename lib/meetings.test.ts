import assert from "node:assert/strict"
import { test } from "node:test"

import {
  bannerState,
  joinUrl,
  meetingSlot,
  parseEmails,
  slackCancelled,
  slackCreated,
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
    slackReminder(m(), TZ),
    "⏰ *Design review* starts in 1 hour (14:00) · <https://meet.google.com/abc-defg-hij|Join>",
  )
  assert.equal(slackCancelled(m(), "Dara", TZ), "✖️ *Design review* on Wed 21 Oct, 14:00 was cancelled by Dara")
})

test("slack text escapes the title and drops Join without a link", () => {
  const bare = m({ title: "A & B <c>", meetUrl: null, calendarUrl: null })
  assert.equal(slackReminder(bare, TZ), "⏰ *A &amp; B &lt;c&gt;* starts in 1 hour (14:00)")
})
