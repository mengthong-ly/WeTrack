import assert from "node:assert/strict"
import { test } from "node:test"

import { buildDigest, type Digest, LIST_LIMIT } from "./digest.ts"

const base: Digest = {
  orgName: "Kinetic",
  today: "2026-10-19",
  appUrl: "https://wetrack.example",
  done: [{ title: "Add preset", project: "AsiaMode", assignee: "Dara Sok" }],
  attention: [
    { title: "PDF export", project: "Lotus Bank", assignee: null, reason: "Overdue" },
    { title: "Vendor login", project: "Vendor Portal", assignee: "Vanna Lim", reason: "Blocked" },
  ],
  projects: [{ name: "Lotus Bank", health: "Behind", open: 3, overdue: 1, progress: 40 }],
  people: [{ name: "Dara Sok", active: 2, dueThisWeek: 1, overdue: 0, doneThisWeek: 1 }],
}

test("subject counts done and overdue", () => {
  assert.equal(buildDigest(base).subject, "Kinetic this week: 1 task done, 1 overdue")
  assert.equal(buildDigest({ ...base, done: [], attention: [] }).subject, "Kinetic this week: 0 tasks done")
})

test("text has every section and the app link", () => {
  const { text } = buildDigest(base)
  assert.match(text, /Done this week \(1\)\n- Add preset — AsiaMode · Dara/)
  assert.match(text, /Needs attention \(2\)\n- Overdue: PDF export — Lotus Bank\n- Blocked: Vendor login — Vendor Portal · Vanna/)
  assert.match(text, /- Lotus Bank: Behind, 40% done, 3 open tasks, 1 overdue/)
  assert.match(text, /- Dara Sok: 2 in progress, 1 due in 7 days, 0 overdue, 1 done/)
  assert.match(text, /Open WeTrack: https:\/\/wetrack\.example$/)
})

test("empty sections say so", () => {
  const { text } = buildDigest({ ...base, done: [], attention: [], projects: [], people: [] })
  assert.match(text, /Done this week \(0\)\nNothing was finished this week\./)
  assert.match(text, /Nothing stuck\./)
})

test("long lists are capped", () => {
  const done = Array.from({ length: LIST_LIMIT + 3 }, (_, i) => ({ title: `T${i}`, project: "P", assignee: null }))
  const { text, html } = buildDigest({ ...base, done })
  assert.equal(text.match(/^- T\d+/gm)?.length, LIST_LIMIT)
  assert.match(text, /and 3 more/)
  assert.match(html, /and 3 more/)
})

test("html escapes user text", () => {
  const { html } = buildDigest({
    ...base,
    orgName: `<b>"Co"</b>`,
    done: [{ title: "<script>alert(1)</script>", project: "A&B", assignee: null }],
  })
  assert.doesNotMatch(html, /<script>|<b>/)
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; — A&amp;B/)
  assert.match(html, /&lt;b&gt;&quot;Co&quot;&lt;\/b&gt;/)
})
