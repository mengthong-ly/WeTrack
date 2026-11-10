import assert from "node:assert/strict"
import test from "node:test"

import { compactTask, matchTasks, TASK_LIST_LIMIT, type TaskLike } from "./agent-tasks.ts"
import type { TaskRow } from "./queries.ts"

// Compile-time only (checked by `pnpm typecheck`): a real TaskRow must be usable as a TaskLike.
export const rowIsTaskLike = (r: TaskRow): TaskLike => r

const t = (id: string, title: string, projectId: string, status: string, userIds: string[]): TaskLike => ({
  id,
  title,
  project: { id: projectId, name: `Project ${projectId}` },
  status,
  priority: "normal",
  progress: 10,
  deadline: "2026-12-01",
  assignees: userIds.map((userId) => ({ userId, user: { id: userId, name: `User ${userId}` } })),
  parentId: null,
  updatedAt: new Date("2026-11-10T08:30:00.000Z"),
})

const rows = [
  t("t1", "Fix login bug", "p1", "in_progress", ["u1"]),
  t("t2", "Write docs", "p1", "done", ["u2"]),
  t("t3", "Login page design", "p2", "in_progress", ["u1", "u2"]),
]
const ids = (f: Parameters<typeof matchTasks>[1]) => matchTasks(rows, f).map((r) => r.id)

test("each filter alone", () => {
  assert.deepEqual(ids({ q: "LOGIN" }), ["t1", "t3"])
  assert.deepEqual(ids({ status: "done" }), ["t2"])
  assert.deepEqual(ids({ project: "p2" }), ["t3"])
  assert.deepEqual(ids({ assignee: "u2" }), ["t2", "t3"])
})

test("filters AND together; empty or absent are ignored", () => {
  assert.deepEqual(ids({ q: "login", status: "in_progress", assignee: "u2" }), ["t3"])
  assert.deepEqual(ids({ project: "p1", status: "in_progress" }), ["t1"])
  assert.deepEqual(ids({}), ["t1", "t2", "t3"])
  assert.deepEqual(ids({ q: "", status: "", project: undefined, assignee: "" }), ["t1", "t2", "t3"])
})

test("q is a literal substring, not a pattern", () => {
  assert.deepEqual(ids({ q: "%" }), [])
  assert.deepEqual(ids({ q: "." }), [])
})

test("compactTask keeps only the agent keys and renders updatedAt as ISO", () => {
  const c = compactTask(rows[2])
  assert.deepEqual(Object.keys(c), [
    "id", "title", "project", "status", "priority", "progress", "deadline", "assignees", "parentId", "updatedAt",
  ])
  assert.deepEqual(c.project, { id: "p2", name: "Project p2" })
  assert.deepEqual(c.assignees, ["User u1", "User u2"])
  assert.equal(c.updatedAt, "2026-11-10T08:30:00.000Z")
})

test("list limit", () => assert.equal(TASK_LIST_LIMIT, 50))
