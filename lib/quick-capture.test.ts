import assert from "node:assert/strict"
import { test } from "node:test"

import { parseCapture, parseDay } from "./quick-capture.ts"

const today = "2026-10-20" // a Tuesday
const ctx = {
  today,
  meId: "u1",
  projects: [
    { id: "p1", name: "AsiaMode" },
    { id: "p2", name: "Vendor Portal" },
  ],
  members: [
    { id: "u1", name: "Mengthong Ly" },
    { id: "u2", name: "Dara Sok" },
  ],
}

test("dates", () => {
  assert.equal(parseDay("today", today), "2026-10-20")
  assert.equal(parseDay("tomorrow", today), "2026-10-21")
  assert.equal(parseDay("fri", today), "2026-10-23")
  assert.equal(parseDay("Tuesday", today), "2026-10-27") // same weekday means next week
  assert.equal(parseDay("next week", today), "2026-10-26")
  assert.equal(parseDay("in 3 days", today), "2026-10-23")
  assert.equal(parseDay("in 2 weeks", today), "2026-11-03")
  assert.equal(parseDay("5 nov", today), "2026-11-05")
  assert.equal(parseDay("Jan 3", today), "2027-01-03")
  assert.equal(parseDay("32 oct", today), null)
  assert.equal(parseDay("31 feb", today), null)
  assert.equal(parseDay("thurs", today), "2026-10-22")
  assert.equal(parseDay("monitoring", today), null)
  assert.equal(parseDay("someday", today), null)
})

test("pulls fields out of the title", () => {
  assert.deepEqual(parseCapture("Fix login #asia @dara due fri !urgent", ctx), {
    title: "Fix login",
    projectId: "p1",
    assigneeId: "u2",
    priority: "urgent",
    deadline: "2026-10-23",
  })
  assert.deepEqual(parseCapture("Add accessories for AsiaMode due Fri", ctx), {
    title: "Add accessories",
    projectId: "p1",
    deadline: "2026-10-23",
  })
  assert.deepEqual(parseCapture("Invoice export for vendor portal @me !low", ctx), {
    title: "Invoice export",
    projectId: "p2",
    assigneeId: "u1",
    priority: "no_rush",
  })
})

test("leaves unknown tokens and bare date words in the title", () => {
  assert.deepEqual(parseCapture("Fix today page #nope @nobody", ctx), { title: "Fix today page #nope @nobody" })
  assert.deepEqual(parseCapture("Email due someday", ctx), { title: "Email due someday" })
})
