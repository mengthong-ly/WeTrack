import assert from "node:assert/strict"
import { test } from "node:test"

import { addMonths, groupByDate, monthRange, paramsKey, readParams } from "./task-views.ts"

const read = (q: string) => readParams(new URLSearchParams(q), "me")

const base = { view: "cards", status: "all", person: null, projectId: null, q: "", show: 50, month: null }

test("view and status params, including old links", () => {
  assert.deepEqual(read(""), base)
  assert.deepEqual(read("view=calendar&status=open&project=p1"), { ...base, view: "calendar", status: "open", projectId: "p1" })
  assert.equal(read("view=nope").view, "cards")
  assert.equal(read("view=date").view, "date")
  assert.deepEqual(read("view=done"), { ...base, status: "done" })
  assert.deepEqual(read("view=mine"), { ...base, status: "open", person: "me" })
  assert.deepEqual(read("layout=board&view=all"), { ...base, view: "board" })
})

test("search, row count and month params are cleaned up", () => {
  assert.equal(read("q=%20login%20").q, "login")
  assert.equal(read("show=100").show, 100)
  assert.equal(read("show=7").show, 50)
  assert.equal(read("show=abc").show, 50)
  assert.equal(read("show=99999").show, 500)
  assert.equal(read("month=2026-11").month, "2026-11")
  assert.equal(read("month=2026-13").month, null)
})

test("paramsKey: one string per page, defaults left out, same for old and new links", () => {
  assert.equal(paramsKey(read("")), "")
  assert.equal(paramsKey(read("show=50&status=all")), "")
  assert.equal(paramsKey(read("view=mine")), paramsKey(read("status=open&person=me")))
  assert.equal(paramsKey(read("project=p1&q=x&show=100")), "project=p1&q=x&show=100")
  // The calendar pages by month, not by row count.
  assert.equal(paramsKey(read("view=calendar&show=100&month=2026-11")), "view=calendar&month=2026-11")
})

test("monthRange: the month plus the week either side, end exclusive", () => {
  assert.deepEqual(monthRange("2026-10"), ["2026-09-25", "2026-11-07"])
  assert.deepEqual(monthRange("2026-12"), ["2026-11-25", "2027-01-07"])
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

test("addMonths crosses years", () => {
  assert.equal(addMonths("2026-12", 1), "2027-01")
  assert.equal(addMonths("2026-01", -1), "2025-12")
})
