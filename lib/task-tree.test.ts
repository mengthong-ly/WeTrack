import assert from "node:assert/strict"
import { test } from "node:test"

import { placeInTree } from "./task-tree.ts"

const row = (id: string, parentId: string | null) => ({ id, parentId, title: id, status: "not_started" as const })

test("placeInTree finds the parents and the whole family in reading order", () => {
  const rows = [row("a", null), row("b", "a"), row("c", "b"), row("d", "a"), row("x", null)]
  const { ancestors, family } = placeInTree(rows, "c")
  assert.deepEqual(ancestors.map((a) => a.id), ["a", "b"])
  assert.deepEqual(family.map((f) => [f.id, f.depth]), [["a", 0], ["b", 1], ["c", 2], ["d", 1]])
})

test("placeInTree stops on a loop", () => {
  const { ancestors } = placeInTree([row("a", "b"), row("b", "a")], "a")
  assert.equal(ancestors.length, 1)
})
