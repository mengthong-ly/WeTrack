// One-off import of the old Google Sheet tracker (Development + Design tabs).
// Usage: pnpm import:sheet <sheet-url-or-id>   (sheet must be shared "anyone with the link")
// Safe to re-run: tasks that already exist (same title in the same project) are skipped.
import { and, asc, eq } from "drizzle-orm"

import { db } from "../lib/db"
import { member, organization, project, release, task } from "../lib/db/schema"
import type { TaskPriority, TaskStatus, TaskType } from "../lib/db/enums"
import { todayISO } from "../lib/schedule"

const arg = process.argv[2]
const sheetId = arg?.match(/\/d\/([\w-]+)/)?.[1] ?? arg
if (!sheetId) throw new Error("Pass the Google Sheet URL or id.")

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') {
        quoted = false
      } else {
        cell += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ",") {
      row.push(cell)
      cell = ""
    } else if (c === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else if (c !== "\r") {
      cell += c
    }
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

async function tab(name: string) {
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error(`Could not read tab "${name}" (${res.status}). Is the sheet shared by link?`)
  const [header, ...rows] = parseCsv(await res.text())
  // Columns by header name; repeated headers ("Status" twice) get #2, #3…
  const seen: Record<string, number> = {}
  const keys = header.map((h) => {
    const k = h.trim().toLowerCase()
    seen[k] = (seen[k] ?? 0) + 1
    return seen[k] > 1 ? `${k}#${seen[k]}` : k
  })
  return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])))
}

const clean = (v: string | undefined) => (v && v !== "--" ? v : "")
const date = (v: string | undefined) => {
  const m = clean(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/) // sheet exports M/D/YYYY
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null
}
const STATUS: Record<string, TaskStatus> = {
  completed: "completed",
  "in progress": "in_progress",
  "not started": "not_started",
  "review/test": "review",
  error: "blocked",
}
const PRIORITY: Record<string, TaskPriority> = { urgent: "urgent", "no rush": "no_rush" }

type Row = {
  title: string
  description: string | null
  client: string
  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  startDate: string | null
  deadline: string | null
  version: string
  released: string | null
}

async function main() {
  const [org] = await db.select().from(organization).orderBy(asc(organization.createdAt)).limit(1)
  if (!org) throw new Error("Sign up and create the workspace first.")
  const owner = await db.query.member.findFirst({
    where: and(eq(member.organizationId, org.id), eq(member.role, "owner")),
  })

  const rows: Row[] = []
  let carryVersion = ""
  let carryReleased: string | null = null
  for (const r of await tab("Development")) {
    const title = clean(r.tasks) || clean(r.descriptions)
    if (!title) continue
    const released = date(r["released date"])
    // A blank version on a row released the same day as the row above belongs to the same release.
    const version: string = clean(r.version) || (released && released === carryReleased ? carryVersion : "")
    ;[carryVersion, carryReleased] = [version, released]
    rows.push({
      title,
      description: clean(r.tasks) ? clean(r.descriptions) || null : null,
      client: clean(r.clients),
      type: "development",
      status: STATUS[clean(r.progress).toLowerCase()] ?? "not_started",
      priority: PRIORITY[clean(r.status).toLowerCase()] ?? "normal",
      startDate: date(r["issue date"]),
      deadline: date(r.deadline),
      version,
      released,
    })
  }
  for (const r of await tab("Design")) {
    const title = clean(r.tasks)
    if (!title) continue
    rows.push({
      title,
      description: clean(r.descriptions) || null,
      client: clean(r.clients),
      type: "design",
      status: STATUS[clean(r["status#2"]).toLowerCase()] ?? "not_started",
      priority: PRIORITY[clean(r.status).toLowerCase()] ?? "normal",
      startDate: date(r.date),
      deadline: null,
      version: "",
      released: date(r["released date"]),
    })
  }

  const today = todayISO()
  const projects = new Map<string, string>()
  const releases = new Map<string, string>()
  let added = 0
  let skipped = 0

  for (const r of rows) {
    const name = r.client || "Unsorted"
    let projectId = projects.get(name)
    if (!projectId) {
      const existing = await db.query.project.findFirst({
        where: and(eq(project.organizationId, org.id), eq(project.name, name)),
      })
      projectId =
        existing?.id ??
        (await db.insert(project).values({ organizationId: org.id, name }).returning())[0].id
      projects.set(name, projectId)
    }

    const dupe = await db.query.task.findFirst({
      where: and(eq(task.projectId, projectId), eq(task.title, r.title)),
    })
    if (dupe) {
      skipped++
      continue
    }

    let releaseId: string | null = null
    if (r.released) {
      const version = r.version || `Release ${r.released}`
      const key = `${projectId}:${version}`
      releaseId = releases.get(key) ?? null
      if (!releaseId) {
        const past = r.released <= today
        const existing = await db.query.release.findFirst({
          where: and(eq(release.projectId, projectId), eq(release.version, version)),
        })
        releaseId =
          existing?.id ??
          (
            await db
              .insert(release)
              .values({
                organizationId: org.id,
                projectId,
                version,
                prodPlanned: r.released,
                prodActual: past ? r.released : null,
              })
              .returning()
          )[0].id
        releases.set(key, releaseId)
      }
    }

    await db.insert(task).values({
      organizationId: org.id,
      projectId,
      releaseId,
      assigneeId: owner?.userId ?? null,
      createdById: owner?.userId ?? null,
      title: r.title,
      description: r.description,
      type: r.type,
      priority: r.priority,
      status: r.status,
      progress: r.status === "completed" ? 100 : 0,
      startDate: r.startDate,
      deadline: r.deadline,
      completedAt: r.status === "completed" ? new Date(`${r.released ?? r.startDate ?? today}T12:00:00`) : null,
    })
    added++
  }

  console.log(`Imported ${added} tasks into "${org.name}" (${skipped} already there). Projects: ${[...projects.keys()].join(", ")}`)
  if (projects.has("Unsorted")) console.log('Some rows had no client — move them out of "Unsorted" from each task page.')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
