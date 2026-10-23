// Fills a throwaway database with a believable team, for demos and checking UI changes.
// Usage:
//   createdb wetrack_demo
//   DATABASE_URL=postgres://localhost:5432/wetrack_demo pnpm exec drizzle-kit migrate
//   DATABASE_URL=postgres://localhost:5432/wetrack_demo pnpm exec tsx scripts/seed-demo.ts
// Sign in as demo@wetrack.test (the code lands in Mailpit). The CEO link is printed at the end.
// Refuses to run unless the database name contains "demo", and wipes that database's data first.
import { createHash } from "node:crypto"

import { sql } from "drizzle-orm"

import { db } from "../lib/db"
import { activity, member, organization, project, shareLink, subtask, task, user } from "../lib/db/schema"
import type { TaskPriority, TaskStatus } from "../lib/db/enums"

if (!/demo/.test(new URL(process.env.DATABASE_URL!).pathname)) throw new Error("DATABASE_URL must point at a *demo* database.")

const DAY = 86_400_000
const now = Date.now()
const iso = (offset: number) => new Date(now + offset * DAY).toISOString().slice(0, 10)
const ago = (days: number) => new Date(now - days * DAY)

await db.execute(sql`truncate "user", organization cascade`)

const [org] = await db.insert(organization).values({ id: "demo-org", name: "Kinetic Studio", slug: "kinetic", createdAt: new Date() }).returning()

const people = [
  { id: "u-demo", name: "Sophea Chan", email: "demo@wetrack.test", role: "owner" },
  { id: "u-dara", name: "Dara Sok", email: "dara@wetrack.test", role: "member" },
  { id: "u-vanna", name: "Vanna Lim", email: "vanna@wetrack.test", role: "member" },
  { id: "u-rith", name: "Rith Keo", email: "rith@wetrack.test", role: "admin" },
  { id: "u-mony", name: "Mony Heng", email: "mony@wetrack.test", role: "member" },
]
for (const p of people) {
  await db.insert(user).values({ id: p.id, name: p.name, email: p.email, emailVerified: true, createdAt: new Date(), updatedAt: new Date() })
  await db.insert(member).values({ id: `m-${p.id}`, organizationId: org.id, userId: p.id, role: p.role, createdAt: new Date() })
}

const projects = await db
  .insert(project)
  .values([
    { organizationId: org.id, name: "AsiaMode", color: "#ec4899" },
    { organizationId: org.id, name: "Vendor Portal", color: "#3b82f6" },
    { organizationId: org.id, name: "Lotus Bank", color: "#22c55e" },
    { organizationId: org.id, name: "Internal tools", color: "#737373" },
  ])
  .returning()
const P = Object.fromEntries(projects.map((p) => [p.name, p.id]))

// [title, project, assignee, status, priority, deadline offset, progress, last update days ago]
type Row = [string, string, string | null, TaskStatus, TaskPriority, number | null, number, number]
const rows: Row[] = [
  ["Checkout redesign for mobile", "AsiaMode", "u-dara", "in_progress", "urgent", 2, 60, 0],
  ["Size guide pop-up", "AsiaMode", "u-vanna", "review", "normal", 4, 90, 1],
  ["Accessories collection page", "AsiaMode", "u-dara", "not_started", "normal", 9, 0, 3],
  ["Fix promo code rounding", "AsiaMode", "u-mony", "in_progress", "urgent", -2, 40, 1],
  ["Product photo zoom", "AsiaMode", null, "not_started", "no_rush", 20, 0, 6],
  ["Homepage banner refresh", "AsiaMode", "u-vanna", "completed", "normal", -1, 100, 1],
  ["Order tracking emails", "AsiaMode", "u-rith", "completed", "normal", -3, 100, 3],
  ["Invoice PDF export", "Vendor Portal", "u-rith", "in_progress", "normal", 6, 30, 7],
  ["Bulk upload products via CSV", "Vendor Portal", "u-demo", "blocked", "urgent", 3, 20, 2],
  ["Vendor onboarding checklist", "Vendor Portal", "u-mony", "not_started", "normal", 12, 0, 4],
  ["Payout report filters", "Vendor Portal", "u-rith", "review", "normal", 1, 85, 0],
  ["Two-factor sign-in", "Vendor Portal", null, "not_started", "urgent", 5, 0, 2],
  ["Commission settings page", "Vendor Portal", "u-demo", "completed", "normal", -5, 100, 5],
  ["Loan calculator widget", "Lotus Bank", "u-vanna", "in_progress", "normal", 15, 50, 1],
  ["Branch locator map", "Lotus Bank", "u-dara", "not_started", "no_rush", 25, 0, 8],
  ["Accessibility audit fixes", "Lotus Bank", "u-vanna", "not_started", "normal", 18, 0, 2],
  ["Rates table CMS block", "Lotus Bank", "u-mony", "completed", "normal", -6, 100, 6],
  ["Staging deploy script", "Internal tools", "u-rith", "in_progress", "no_rush", null, 70, 9],
  ["Design tokens clean-up", "Internal tools", "u-demo", "not_started", "no_rush", null, 0, 10],
  ["Error alerts to chat", "Internal tools", "u-demo", "completed", "normal", -2, 100, 2],
]

for (const [title, proj, assigneeId, status, priority, due, progress, quiet] of rows) {
  const [t] = await db
    .insert(task)
    .values({
      organizationId: org.id,
      projectId: P[proj],
      assigneeId,
      createdById: "u-demo",
      title,
      status,
      priority,
      progress,
      deadline: due === null ? null : iso(due),
      completedAt: status === "completed" ? ago(quiet) : null,
      createdAt: ago(quiet + 10),
    })
    .returning()
  // $onUpdate stamps updatedAt on insert too, so backdate it afterwards for "gone quiet" tasks.
  await db.execute(sql`update task set updated_at = ${ago(quiet).toISOString()} where id = ${t.id}`)
  if (status === "in_progress" || status === "review") {
    await db.insert(subtask).values([
      { taskId: t.id, title: "Build it", done: true, position: 0 },
      { taskId: t.id, title: "Review with the client", done: status === "review", position: 1 },
      { taskId: t.id, title: "Ship to staging", done: false, position: 2 },
    ])
  }
  await db.insert(activity).values({
    organizationId: org.id,
    projectId: P[proj],
    taskId: t.id,
    actorId: assigneeId ?? "u-demo",
    kind: status === "completed" ? "task_completed" : status === "not_started" ? "task_created" : "status_changed",
    data: { from: "not_started", to: status },
    createdAt: ago(quiet),
  })
}

const token = "demo-ceo-link-0123456789abcdef"
await db.insert(shareLink).values({
  organizationId: org.id,
  tokenHash: createHash("sha256").update(token).digest("hex"),
  createdById: "u-demo",
})

console.log(`Seeded ${rows.length} tasks. CEO link: /r/${token}`)
process.exit(0)
