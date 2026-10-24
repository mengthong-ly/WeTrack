import type { TaskStatus } from "./db/enums.ts"

type TreeRow = { id: string; parentId: string | null; title: string; status: TaskStatus }

// Where a task sits: the chain of parents above it (root first) and its whole family from the root down,
// in reading order with each row's depth, for the page's contents list.
export function placeInTree(rows: TreeRow[], id: string) {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const kids = Map.groupBy(rows, (r) => r.parentId)
  const ancestors: { id: string; title: string }[] = []
  // `seen` guards against a loop in bad data, so the walk always ends.
  for (let p = byId.get(id)?.parentId, seen = new Set([id]); p && !seen.has(p); p = byId.get(p)?.parentId) {
    seen.add(p)
    const row = byId.get(p)
    if (row) ancestors.unshift({ id: row.id, title: row.title })
  }
  const family: { id: string; title: string; status: TreeRow["status"]; depth: number }[] = []
  const walk = (rowId: string, depth: number) => {
    const row = byId.get(rowId)
    if (!row || family.some((f) => f.id === rowId)) return
    family.push({ id: row.id, title: row.title, status: row.status, depth })
    for (const k of kids.get(rowId) ?? []) walk(k.id, depth + 1)
  }
  walk(ancestors[0]?.id ?? id, 0)
  return { ancestors, family }
}
