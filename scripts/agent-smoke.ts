// End-to-end check of the agent API against a running dev server and a throwaway database.
// Usage:
//   createdb wetrack_agent_smoke
//   DATABASE_URL=postgres://localhost:5432/wetrack_agent_smoke pnpm exec drizzle-kit migrate
//   DATABASE_URL=postgres://localhost:5432/wetrack_agent_smoke pnpm exec next dev -p 3101
//   DATABASE_URL=postgres://localhost:5432/wetrack_agent_smoke pnpm exec tsx scripts/agent-smoke.ts
// Refuses to run unless the database name contains "smoke". Builds its own fixtures and deletes them at the end.
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"

import { and, eq, inArray } from "drizzle-orm"

import { AGENT_KEY_DAYS, hashAgentKey, newAgentKey } from "../lib/agent-key"
import { db } from "../lib/db"
import { activity, agentKey, comment, logEntry, member, organization, project, task, taskAssignee, user } from "../lib/db/schema"
import type { TaskStatus } from "../lib/db/enums"

if (!/smoke/.test(new URL(process.env.DATABASE_URL!).pathname)) throw new Error("DATABASE_URL must point at a *smoke* database.")

const BASE = process.env.AGENT_SMOKE_URL ?? "http://localhost:3101"
const KEY_RE = /wt_[\w-]{43}/
const DAY = 86_400_000
const iso = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10)
const s = randomBytes(4).toString("hex")
const users = { owner: `smk-owner-${s}`, member: `smk-member-${s}`, gone: `smk-gone-${s}`, other: `smk-other-${s}` }
const orgs = { main: `smk-org-${s}`, other: `smk-org2-${s}` }

// The response fields read below.
type T = { id: string; title: string; project: { id: string }; assignees: string[]; reason?: string }
type Body = {
  error?: string
  id: string
  workspace: string
  you: unknown
  today: string
  totals: Record<string, number>
  projects: { id: string }[]
  attention: T[]
  doneThisWeek: T[]
  tasks: T[]
  more: boolean
}
type Logged = { via?: string } | null

let checks = 0
const ok = (name: string) => console.log(`ok ${++checks} ${name}`)

async function call(path: string, key: string | null, init: { method?: string; body?: unknown; raw?: string; accept?: string } = {}) {
  const headers: Record<string, string> = {}
  if (key) headers.authorization = `Bearer ${key}`
  if (init.accept) headers.accept = init.accept
  if (init.body !== undefined || init.raw !== undefined) headers["content-type"] = "application/json"
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.raw ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
    redirect: "manual",
  })
  const text = await res.text()
  assert.doesNotMatch(text, KEY_RE, `${path}: response body contains a key`)
  let json: unknown = null
  try {
    json = JSON.parse(text)
  } catch {}
  return { status: res.status, headers: res.headers, text, json: json as Body }
}

// One JSON-RPC request to the stateless MCP endpoint; no initialize handshake, no session id.
let rpcId = 0
const mcp = (key: string | null, method: string, params: object = {}) =>
  call("/api/mcp", key, { method: "POST", body: { jsonrpc: "2.0", id: ++rpcId, method, params }, accept: "application/json, text/event-stream" })

type ToolResult = { isError?: boolean; content: { type: string; text: string }[]; structuredContent?: Body }
async function tool(key: string, name: string, args: object) {
  const r = await mcp(key, "tools/call", { name, arguments: args })
  assert.equal(r.status, 200, `${name}: ${r.status} ${r.text.slice(0, 300)}`)
  const result = (r.json as unknown as { result: ToolResult }).result
  assert.ok(result, `${name}: no result in ${r.text.slice(0, 300)}`)
  return { isError: result.isError === true, text: result.content[0]?.text ?? "", data: result.structuredContent }
}

async function seed() {
  const now = new Date()
  await db.insert(user).values(
    Object.entries(users).map(([k, id]) => ({ id, name: `Smoke ${k}`, email: `${id}@smoke.test`, emailVerified: true, createdAt: now, updatedAt: now }))
  )
  await db.insert(organization).values([
    { id: orgs.main, name: `Smoke Studio ${s}`, slug: orgs.main, createdAt: now },
    { id: orgs.other, name: `Other Studio ${s}`, slug: orgs.other, createdAt: now },
  ])
  // `gone` has a key for the main workspace but no membership: a teammate who was removed.
  await db.insert(member).values([
    { id: `m-${users.owner}`, organizationId: orgs.main, userId: users.owner, role: "owner", createdAt: now },
    { id: `m-${users.member}`, organizationId: orgs.main, userId: users.member, role: "member", createdAt: now },
    { id: `m-${users.other}`, organizationId: orgs.other, userId: users.other, role: "owner", createdAt: now },
  ])
  const [p1, p2, p3] = await db
    .insert(project)
    .values([
      { organizationId: orgs.main, name: "Smoke Web", color: "#3b82f6" },
      { organizationId: orgs.main, name: "Smoke Ops", color: "#22c55e" },
      { organizationId: orgs.other, name: "Elsewhere", color: "#737373" },
    ])
    .returning()
  const mk = async (projectId: string, org: string, title: string, status: TaskStatus, due: number | null, who: string | null) => {
    const [t] = await db
      .insert(task)
      .values({
        organizationId: org,
        projectId,
        title,
        status,
        assigneeId: who,
        createdById: users.owner,
        progress: status === "completed" ? 100 : 0,
        deadline: due === null ? null : iso(due),
        completedAt: status === "completed" ? now : null,
      })
      .returning()
    if (who) await db.insert(taskAssignee).values({ taskId: t.id, userId: who })
    return t
  }
  const tasks = {
    todo: await mk(p1.id, orgs.main, "Smoke todo", "not_started", 10, users.owner),
    late: await mk(p1.id, orgs.main, "Smoke late", "in_progress", -2, users.member),
    stuck: await mk(p1.id, orgs.main, "Smoke stuck", "blocked", 5, users.member),
    done: await mk(p1.id, orgs.main, "Smoke done", "completed", -1, users.owner),
    ops: await mk(p2.id, orgs.main, "Smoke ops orphan", "not_started", null, null),
    foreign: await mk(p3.id, orgs.other, "Foreign task", "not_started", null, users.other),
  }

  const keys = { owner: newAgentKey(), member: newAgentKey(), revoked: newAgentKey(), expired: newAgentKey(), gone: newAgentKey() }
  const expires = new Date(Date.now() + AGENT_KEY_DAYS * DAY)
  const row = (userId: string, k: string, extra: object = {}) => ({
    organizationId: orgs.main,
    userId,
    name: "smoke",
    tokenHash: hashAgentKey(k),
    expiresAt: expires,
    ...extra,
  })
  await db.insert(agentKey).values([
    row(users.owner, keys.owner),
    row(users.member, keys.member),
    row(users.owner, keys.revoked, { revokedAt: now }),
    row(users.owner, keys.expired, { expiresAt: new Date(Date.now() - DAY) }),
    row(users.gone, keys.gone),
  ])
  return { projects: { p1, p2, p3 }, tasks, keys }
}

async function run({ projects, tasks, keys }: Awaited<ReturnType<typeof seed>>) {
  // 401s: one body, JSON, never a redirect.
  for (const [name, key] of [
    ["no header", null],
    ["garbage", "garbage"],
    ["revoked", keys.revoked],
    ["expired", keys.expired],
    ["removed member", keys.gone],
  ] as const) {
    const r = await call("/api/agent/report", key)
    assert.equal(r.status, 401, `${name}: ${r.status} ${r.text.slice(0, 200)}`)
    assert.equal(r.json?.error, "Invalid or expired API key", name)
    assert.equal(r.headers.get("location"), null, `${name}: 401 has a location header`)
  }
  ok("bad keys get 401 JSON, no location")

  // A key authenticates nothing outside /api/agent.
  const outside = await call("/api/tasks", keys.owner)
  assert.ok([307, 401].includes(outside.status), `/api/tasks with a key: ${outside.status}`)
  assert.doesNotMatch(outside.text, /Smoke (todo|late|stuck)/)
  ok("key does not work outside /api/agent")

  // Report.
  const rep = await call("/api/agent/report", keys.owner)
  assert.equal(rep.status, 200, rep.text.slice(0, 500))
  assert.equal(rep.headers.get("cache-control"), "private, no-store")
  assert.equal(rep.json.workspace, `Smoke Studio ${s}`)
  assert.deepEqual(rep.json.you, { id: users.owner, name: "Smoke owner" })
  for (const k of ["today", "totals", "projects", "people", "attention", "doneThisWeek", "recent"]) assert.ok(k in rep.json, `report.${k}`)
  assert.deepEqual(
    { open: rep.json.totals.open, done: rep.json.totals.done, overdue: rep.json.totals.overdue, blocked: rep.json.totals.blocked },
    { open: 4, done: 1, overdue: 1, blocked: 1 }
  )
  assert.equal(rep.json.projects.length, 2)
  const reasons = Object.fromEntries(rep.json.attention.map((a: T) => [a.title, a.reason]))
  assert.equal(reasons["Smoke late"], "Overdue")
  assert.equal(reasons["Smoke stuck"], "Blocked")
  assert.equal(reasons["Smoke ops orphan"], "Nobody on it")
  assert.ok(!JSON.stringify(rep.json).includes("Foreign task"))
  assert.deepEqual(rep.json.doneThisWeek.map((t: T) => t.title), ["Smoke done"])
  ok("report for the workspace")

  const scoped = await call(`/api/agent/report?project=${projects.p1.id}`, keys.owner)
  assert.equal(scoped.status, 200, scoped.text.slice(0, 500))
  assert.deepEqual(scoped.json.projects.map((p: { id: string }) => p.id), [projects.p1.id])
  assert.ok(scoped.json.attention.every((a: T) => a.project.id === projects.p1.id))
  assert.equal(scoped.json.totals.open, 3)
  const foreignReport = await call(`/api/agent/report?project=${projects.p3.id}`, keys.owner)
  assert.equal(foreignReport.status, 404, foreignReport.text)
  ok("report scoped to a project; foreign project 404")

  // Task list.
  const mine = await call("/api/agent/tasks?assignee=me", keys.member)
  assert.equal(mine.status, 200, mine.text.slice(0, 500))
  assert.deepEqual(mine.json.tasks.map((t: T) => t.title).sort(), ["Smoke late", "Smoke stuck"])
  assert.ok(mine.json.tasks.every((t: T) => t.assignees.includes("Smoke member")))
  assert.equal(mine.json.more, false)
  const found = await call(`/api/agent/tasks?q=STUCK&status=blocked&project=${projects.p1.id}`, keys.owner)
  assert.deepEqual(found.json.tasks.map((t: T) => t.id), [tasks.stuck.id])
  ok("task list filters; assignee=me is the key owner")

  // Create: identity comes from each request's own key, even in parallel.
  const fields = (title: string) => ({
    title,
    description: null,
    projectId: projects.p2.id,
    assigneeId: null,
    type: "development",
    priority: "normal",
    status: "not_started",
    progress: 0,
    startDate: null,
    deadline: null,
  })
  const created = await Promise.all(
    Array.from({ length: 6 }, (_, i) => {
      const who = i % 2 ? "member" : "owner"
      return call("/api/agent/tasks", keys[who], { method: "POST", body: fields(`Smoke created ${i}`) }).then((r) => ({ who, r }))
    })
  )
  for (const { who, r } of created) {
    assert.equal(r.status, 200, `create as ${who}: ${r.status} ${r.text.slice(0, 300)}`)
    const row = await db.query.task.findFirst({ where: eq(task.id, r.json.id) })
    assert.equal(row?.createdById, users[who as "owner" | "member"], `created task ${r.json.id} has the wrong creator`)
  }
  const createdLogs = await db
    .select()
    .from(logEntry)
    .where(and(eq(logEntry.organizationId, orgs.main), eq(logEntry.action, "task.create")))
  assert.equal(createdLogs.length, 6)
  for (const l of createdLogs) {
    assert.equal((l?.data as Logged)?.via, "agent")
    const t = created.find((c) => c.r.json.id === l.targetId)!
    assert.equal(l.actorId, users[t.who as "owner" | "member"])
  }
  ok("parallel creates belong to each key's owner, logged via agent")

  const badCreate = await call("/api/agent/tasks", keys.owner, { method: "POST", body: { ...fields("x"), projectId: projects.p3.id } })
  assert.equal(badCreate.status, 404, badCreate.text)
  ok("create in a foreign project 404")

  // Invalid JSON.
  for (const [method, path] of [
    ["POST", "/api/agent/tasks"],
    ["PATCH", `/api/agent/tasks/${tasks.todo.id}`],
    ["POST", `/api/agent/tasks/${tasks.todo.id}/notes`],
  ]) {
    const r = await call(path, keys.owner, { method, raw: "{not json" })
    assert.equal(r.status, 400, `${method} ${path}: ${r.status}`)
    assert.deepEqual(r.json, { error: "Invalid JSON." })
  }
  ok("invalid JSON is 400")

  // Validation leaves the row alone.
  const before = await db.query.task.findFirst({ where: eq(task.id, tasks.todo.id) })
  for (const patch of [{ progress: 150 }, { status: "nope" }, { deadline: "31-12-2026" }]) {
    const r = await call(`/api/agent/tasks/${tasks.todo.id}`, keys.owner, { method: "PATCH", body: patch })
    assert.equal(r.status, 400, `${JSON.stringify(patch)}: ${r.status} ${r.text}`)
    assert.ok(typeof r.json.error === "string")
  }
  const after = await db.query.task.findFirst({ where: eq(task.id, tasks.todo.id) })
  assert.deepEqual(after, before)
  for (const body of ["x".repeat(5001), ""]) {
    const r = await call(`/api/agent/tasks/${tasks.todo.id}/notes`, keys.owner, { method: "POST", body: { body } })
    assert.equal(r.status, 400, `note of ${body.length}: ${r.status}`)
  }
  assert.equal(await db.$count(comment, eq(comment.taskId, tasks.todo.id)), 0)
  ok("bad patches and notes are 400 and change nothing")

  const foreignPatch = await call(`/api/agent/tasks/${tasks.foreign.id}`, keys.owner, { method: "PATCH", body: { status: "completed" } })
  assert.equal(foreignPatch.status, 404, foreignPatch.text)
  const foreignNote = await call(`/api/agent/tasks/${tasks.foreign.id}/notes`, keys.owner, { method: "POST", body: { body: "hi" } })
  assert.equal(foreignNote.status, 404, foreignNote.text)
  assert.equal((await db.query.task.findFirst({ where: eq(task.id, tasks.foreign.id) }))?.status, "not_started")
  ok("another workspace's task is 404")

  // A real update and note, as the key's owner, marked via agent.
  const patched = await call(`/api/agent/tasks/${tasks.todo.id}`, keys.owner, { method: "PATCH", body: { status: "in_progress" } })
  assert.equal(patched.status, 200, patched.text)
  assert.deepEqual(patched.json, {})
  const changed = await db
    .select()
    .from(activity)
    .where(and(eq(activity.taskId, tasks.todo.id), eq(activity.kind, "status_changed")))
  assert.equal(changed.length, 1)
  assert.equal(changed[0].actorId, users.owner)
  const [updLog] = await db
    .select()
    .from(logEntry)
    .where(and(eq(logEntry.targetId, tasks.todo.id), eq(logEntry.action, "task.update")))
  assert.equal(updLog?.actorId, users.owner)
  assert.equal((updLog?.data as Logged)?.via, "agent")
  ok("PATCH status writes status_changed and a via-agent log")

  const noted = await call(`/api/agent/tasks/${tasks.todo.id}/notes`, keys.member, { method: "POST", body: { body: "Smoke progress note" } })
  assert.equal(noted.status, 200, noted.text)
  const [c] = await db.select().from(comment).where(eq(comment.taskId, tasks.todo.id))
  assert.equal(c?.authorId, users.member)
  const [noteLog] = await db
    .select()
    .from(logEntry)
    .where(and(eq(logEntry.targetId, tasks.todo.id), eq(logEntry.action, "comment.create")))
  assert.equal(noteLog?.actorId, users.member)
  assert.equal((noteLog?.data as Logged)?.via, "agent")
  ok("note is a comment by the key's owner, logged via agent")

  // MCP: same keys, same operations, one endpoint.
  const mcpRevoked = await mcp(keys.revoked, "tools/list")
  assert.equal(mcpRevoked.status, 401, mcpRevoked.text)
  assert.equal(mcpRevoked.json?.error, "Invalid or expired API key")
  assert.equal(mcpRevoked.headers.get("location"), null)
  ok("MCP with a revoked key is 401 JSON, no location")

  const listed = await mcp(keys.owner, "tools/list")
  assert.equal(listed.status, 200, listed.text.slice(0, 300))
  const names = (listed.json as unknown as { result: { tools: { name: string }[] } }).result.tools.map((t) => t.name).sort()
  assert.deepEqual(names, ["wetrack_add_note", "wetrack_create_task", "wetrack_list_tasks", "wetrack_report", "wetrack_update_task"])
  ok("MCP tools/list has the five tools")

  const mcpReport = await tool(keys.owner, "wetrack_report", {})
  assert.equal(mcpReport.isError, false, mcpReport.text)
  assert.equal(JSON.parse(mcpReport.text).workspace, `Smoke Studio ${s}`)
  assert.equal(mcpReport.data?.workspace, `Smoke Studio ${s}`)
  ok("MCP wetrack_report names the workspace")

  const lateBefore = await db.query.task.findFirst({ where: eq(task.id, tasks.late.id) })
  const badStatus = await tool(keys.owner, "wetrack_update_task", { id: tasks.late.id, status: "nope" })
  assert.equal(badStatus.isError, true, badStatus.text)
  const foreignTool = await tool(keys.owner, "wetrack_update_task", { id: tasks.foreign.id, status: "completed" })
  assert.equal(foreignTool.isError, true)
  assert.deepEqual(JSON.parse(foreignTool.text), { error: "Task not found." })
  assert.deepEqual(await db.query.task.findFirst({ where: eq(task.id, tasks.late.id) }), lateBefore)
  assert.equal((await db.query.task.findFirst({ where: eq(task.id, tasks.foreign.id) }))?.status, "not_started")
  ok("MCP bad update is an isError result and changes nothing")

  const mcpNote = await tool(keys.member, "wetrack_add_note", { id: tasks.stuck.id, body: "Smoke MCP note" })
  assert.equal(mcpNote.isError, false, mcpNote.text)
  const [mc] = await db.select().from(comment).where(eq(comment.taskId, tasks.stuck.id))
  assert.equal(mc?.authorId, users.member)
  assert.equal(mc?.body, "Smoke MCP note")
  const [mcpLog] = await db
    .select()
    .from(logEntry)
    .where(and(eq(logEntry.targetId, tasks.stuck.id), eq(logEntry.action, "comment.create")))
  assert.equal(mcpLog?.actorId, users.member)
  assert.equal((mcpLog?.data as Logged)?.via, "agent")
  ok("MCP note is a comment by the key's owner, logged via agent")

  for (const method of ["GET", "DELETE"]) {
    const r = await call("/api/mcp", keys.owner, { method })
    assert.equal(r.status, 405, `${method} /api/mcp: ${r.status}`)
    assert.ok(typeof r.json?.error === "string")
  }
  ok("GET and DELETE /api/mcp are 405")

  // No key in anything stored.
  const stored = [
    ...(await db.select({ d: logEntry.data, l: logEntry.label }).from(logEntry).where(inArray(logEntry.organizationId, Object.values(orgs)))),
    ...(await db.select({ d: activity.data, l: activity.kind }).from(activity).where(inArray(activity.organizationId, Object.values(orgs)))),
  ]
  assert.ok(stored.length > 0)
  for (const r of stored) assert.doesNotMatch(JSON.stringify(r), KEY_RE)
  ok("no key in log or activity rows")
}

async function cleanup() {
  // Orgs cascade to members, projects, tasks, keys, activity and logs; then the users.
  await db.delete(organization).where(inArray(organization.id, Object.values(orgs)))
  await db.delete(user).where(inArray(user.id, Object.values(users)))
  const left = await db.$count(agentKey, inArray(agentKey.userId, Object.values(users)))
  console.log(`cleaned up (keys left: ${left})`)
}

let failed = false
try {
  await run(await seed())
  console.log(`all ${checks} checks passed`)
} catch (e) {
  failed = true
  console.error(`FAILED after ${checks} checks:`, e)
} finally {
  await cleanup()
}
process.exit(failed ? 1 : 0)
