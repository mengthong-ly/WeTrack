import assert from "node:assert/strict"
import { test } from "node:test"

import { feedbackKey, meetingsKey, nextSort, pageCount, pageWindow, readFeedbackParams, readMeetingParams, readPage, readSort, sortParams, sortRows } from "./paging.ts"

test("readPage: 1-based, junk and out-of-range fall back to 1", () => {
  const read = (q: string) => readPage(new URLSearchParams(q))
  assert.equal(read(""), 1)
  assert.equal(read("page=3"), 3)
  assert.equal(read("page=0"), 1)
  assert.equal(read("page=-2"), 1)
  assert.equal(read("page=abc"), 1)
  assert.equal(read("page=2.7"), 2)
})

test("pageCount: at least one page", () => {
  assert.equal(pageCount(0), 1)
  assert.equal(pageCount(25), 1)
  assert.equal(pageCount(26), 2)
})

test("pageWindow: every page up to 7, then a fixed 7 slots with gaps as null", () => {
  assert.deepEqual(pageWindow(1, 1), [1])
  assert.deepEqual(pageWindow(3, 7), [1, 2, 3, 4, 5, 6, 7])
  assert.deepEqual(pageWindow(1, 10), [1, 2, 3, 4, 5, null, 10])
  assert.deepEqual(pageWindow(4, 10), [1, 2, 3, 4, 5, null, 10])
  assert.deepEqual(pageWindow(5, 10), [1, null, 4, 5, 6, null, 10])
  assert.deepEqual(pageWindow(7, 10), [1, null, 6, 7, 8, 9, 10])
  assert.deepEqual(pageWindow(10, 10), [1, null, 6, 7, 8, 9, 10])
})

test("feedback params: page in the key only when past the first", () => {
  const p = readFeedbackParams(new URLSearchParams("project=p1&who=mine&page=2"), "all")
  assert.deepEqual(p, { who: "mine", projectId: "p1", fixed: false, page: 2, sort: null, dir: "asc" })
  assert.equal(feedbackKey(p), "project=p1&who=mine&page=2")
  assert.equal(feedbackKey({ ...p, page: 1 }), "project=p1&who=mine")
})

test("meeting params: upcoming and mine by default, junk tabs ignored", () => {
  const read = (q: string) => readMeetingParams(new URLSearchParams(q))
  assert.deepEqual(read(""), { tab: "upcoming", mine: true, q: "", page: 1, sort: null, dir: "asc" })
  assert.deepEqual(read("tab=past&who=all&q=%20sync%20&page=3"), { tab: "past", mine: false, q: "sync", page: 3, sort: null, dir: "asc" })
  assert.equal(read("tab=nope").tab, "upcoming")
  assert.equal(meetingsKey(read("tab=upcoming&who=me&page=1")), "")
  assert.equal(meetingsKey(read("tab=cancelled&who=all&page=2")), "tab=cancelled&who=all&page=2")
})

test("readSort: known columns only, asc unless ?dir=desc", () => {
  const read = (q: string) => readSort(new URLSearchParams(q), ["title", "deadline"] as const)
  assert.deepEqual(read(""), { sort: null, dir: "asc" })
  assert.deepEqual(read("sort=deadline&dir=desc"), { sort: "deadline", dir: "desc" })
  assert.deepEqual(read("sort=nope&dir=desc"), { sort: null, dir: "asc" })
  assert.deepEqual(read("sort=title&dir=sideways"), { sort: "title", dir: "asc" })
})

test("nextSort: a new column starts ascending, then descending, then back to the default order", () => {
  const off = { sort: null, dir: "asc" } as const
  assert.deepEqual(nextSort(off, "title"), { sort: "title", dir: "asc" })
  assert.deepEqual(nextSort({ sort: "title", dir: "asc" }, "title"), { sort: "title", dir: "desc" })
  assert.deepEqual(nextSort({ sort: "title", dir: "desc" }, "title"), off)
  assert.deepEqual(nextSort({ sort: "title", dir: "desc" }, "deadline"), { sort: "deadline", dir: "asc" })
  assert.deepEqual(sortParams({ sort: "title", dir: "desc" }), { sort: "title", dir: "desc" })
  assert.deepEqual(sortParams({ sort: "title", dir: "asc" }), { sort: "title", dir: null })
  assert.deepEqual(sortParams(off), { sort: null, dir: null })
})

test("sorted keys carry the sort, and feedback reads its columns", () => {
  const p = readFeedbackParams(new URLSearchParams("project=p1&who=all&sort=given&dir=desc"), "all")
  assert.equal(feedbackKey(p), "project=p1&who=all&sort=given&dir=desc")
  assert.equal(meetingsKey(readMeetingParams(new URLSearchParams("sort=title"))), "sort=title")
})

test("sortRows: by the column's value, empty values last either way, untouched with no sort", () => {
  const rows = [{ n: "b", v: 2 }, { n: "A", v: null }, { n: "c", v: 1 }]
  const get = { name: (r: (typeof rows)[number]) => r.n, value: (r: (typeof rows)[number]) => r.v }
  assert.equal(sortRows(rows, { sort: null, dir: "asc" }, get), rows)
  assert.deepEqual(sortRows(rows, { sort: "name", dir: "asc" }, get).map((r) => r.n), ["A", "b", "c"])
  assert.deepEqual(sortRows(rows, { sort: "value", dir: "asc" }, get).map((r) => r.n), ["c", "b", "A"])
  assert.deepEqual(sortRows(rows, { sort: "value", dir: "desc" }, get).map((r) => r.n), ["b", "c", "A"])
})
