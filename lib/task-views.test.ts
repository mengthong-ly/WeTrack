import assert from "node:assert/strict"
import { test } from "node:test"

import { addMonths, groupByDate, monthGrid, readParams } from "./task-views.ts"

const read = (q: string) => readParams(new URLSearchParams(q), "me")

test("view and status params, including old links", () => {
  assert.deepEqual(read(""), { view: "date", status: "all", person: null, projectId: null })
  assert.deepEqual(read("view=calendar&status=open&project=p1"), { view: "calendar", status: "open", person: null, projectId: "p1" })
  assert.equal(read("view=nope").view, "date")
  assert.deepEqual(read("view=done"), { view: "date", status: "done", person: null, projectId: null })
  assert.deepEqual(read("view=mine"), { view: "date", status: "open", person: "me", projectId: null })
  assert.deepEqual(read("layout=board&view=all"), { view: "board", status: "all", person: null, projectId: null })
})

test("groupByDate: overdue, each day soonest first, no deadline, done earlier", () => {
  const t = (id: string, deadline: string | null, status = "not_started") => ({ id, deadline, status })
  const groups = groupByDate(
    [t("old-done", "2026-10-01", "completed"), t("late", "2026-10-10"), t("today", "2026-10-20"), t("fri", "2026-10-23"), t("tmrw", "2026-10-21"), t("none", null), t("done-late", "2026-10-15", "completed")],
    "2026-10-20"
  )
  assert.deepEqual(
    groups.map((g) => [g.title, g.tasks.map((x) => x.id)]),
    [
      ["Overdue", ["late"]],
      ["Today", ["today"]],
      ["Tomorrow", ["tmrw"]],
      ["Fri 23 Oct", ["fri"]],
      ["No deadline", ["none"]],
      ["Completed earlier", ["done-late", "old-done"]],
    ]
  )
})

test("monthGrid covers whole Monday-first weeks", () => {
  const oct = monthGrid("2026-10") // 1 Oct 2026 is a Thursday
  assert.equal(oct.length, 35)
  assert.equal(oct[0], "2026-09-28")
  assert.equal(oct[3], "2026-10-01")
  assert.equal(oct.at(-1), "2026-11-01")
  assert.equal(monthGrid("2027-02").length, 28) // starts on a Monday, 28 days
  assert.equal(addMonths("2026-12", 1), "2027-01")
  assert.equal(addMonths("2026-01", -1), "2025-12")
})
