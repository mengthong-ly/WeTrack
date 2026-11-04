import assert from "node:assert/strict"
import { test } from "node:test"

import { groupByDate, paramsKey, readParams } from "./task-views.ts"

const read = (q: string) => readParams(new URLSearchParams(q), "me")

const base = { view: "table", status: "all", person: null, projectId: null, q: "", page: 1, sort: null, dir: "asc" }

test("view and status params, including old links", () => {
  assert.deepEqual(read(""), base)
  assert.deepEqual(read("view=date&status=open&project=p1"), { ...base, view: "date", status: "open", projectId: "p1" })
  assert.equal(read("view=nope").view, "table")
  assert.equal(read("view=cards").view, "cards")
  assert.equal(read("view=priority").view, "priority")
  // Board and Calendar are gone: their links open the table.
  assert.equal(read("view=board").view, "table")
  assert.equal(read("view=calendar").view, "table")
  assert.deepEqual(read("view=done"), { ...base, status: "done" })
  assert.deepEqual(read("view=mine"), { ...base, status: "open", person: "me" })
  assert.deepEqual(read("layout=board&view=all"), base)
})

test("search, page and sort params are cleaned up", () => {
  assert.equal(read("q=%20login%20").q, "login")
  assert.equal(read("page=3").page, 3)
  assert.equal(read("page=abc").page, 1)
  assert.equal(read("show=100").page, 1)
  assert.deepEqual([read("sort=deadline&dir=desc").sort, read("sort=deadline&dir=desc").dir], ["deadline", "desc"])
  assert.equal(read("sort=body").sort, null)
})

test("paramsKey: one string per page, defaults left out, same for old and new links", () => {
  assert.equal(paramsKey(read("")), "")
  assert.equal(paramsKey(read("page=1&status=all&view=table")), "")
  assert.equal(paramsKey(read("view=mine")), paramsKey(read("status=open&person=me")))
  assert.equal(paramsKey(read("project=p1&q=x&page=2")), "project=p1&q=x&page=2")
  assert.equal(paramsKey(read("sort=title&dir=asc")), "sort=title")
  assert.equal(paramsKey(read("sort=title&dir=desc&page=2")), "sort=title&dir=desc&page=2")
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
