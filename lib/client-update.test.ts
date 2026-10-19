import assert from "node:assert/strict"
import { test } from "node:test"

import {
  draftMessage,
  groupUpdates,
  type UpdateEvent,
  type UpdateTask,
} from "./client-update.ts"

const tasks: UpdateTask[] = [
  { id: "a", title: "Add Preset", status: "completed", deadline: "2026-10-20" },
  {
    id: "b",
    title: "PDF export",
    status: "in_progress",
    deadline: "2026-10-30",
  },
  { id: "c", title: "Vendor portal", status: "not_started", deadline: null },
]
const ev = (
  id: string,
  kind: string,
  taskId: string | null,
  createdAt: string
): UpdateEvent => ({ id, kind, taskId, createdAt })

test("groups events per task and orders by bucket", () => {
  const items = groupUpdates(
    [
      ev("1", "status_changed", "b", "2026-10-19T09:00:00Z"),
      ev("2", "deadline_changed", "b", "2026-10-19T10:00:00Z"),
      ev("3", "status_changed", "a", "2026-10-19T11:00:00Z"),
      ev("4", "task_completed", "a", "2026-10-19T12:00:00Z"),
      ev("5", "deadline_changed", "c", "2026-10-18T12:00:00Z"),
      ev("6", "status_changed", "gone", "2026-10-18T12:00:00Z"),
    ],
    tasks
  )
  assert.deepEqual(
    items.map((i) => i.taskId),
    ["a", "b", "c"]
  )
  assert.deepEqual(items[0].ids, ["3", "4"])
  assert.equal(items[0].deadlineMoved, undefined)
  assert.equal(items[1].deadlineMoved, "2026-10-30")
  assert.equal(items[2].deadlineMoved, null)
})

test("drafts a plain-text message with headings and date notes", () => {
  const items = groupUpdates(
    [
      ev("1", "task_completed", "a", "2026-10-19T09:00:00Z"),
      ev("2", "deadline_changed", "b", "2026-10-19T10:00:00Z"),
      ev("3", "deadline_changed", "c", "2026-10-19T10:00:00Z"),
    ],
    tasks
  )
  const msg = draftMessage("AsiaMode", items, "2026-10-19")
  assert.match(msg, /^Hi AsiaMode team, here's our latest progress \(19 Oct\):/)
  assert.match(
    msg,
    /Done\n• Add Preset\n\nIn progress\n• PDF export \(new target date: 30 Oct\)/
  )
  assert.match(msg, /Coming up\n• Vendor portal \(new date to be confirmed\)/)
  assert.doesNotMatch(msg, /Blocked/)
})
