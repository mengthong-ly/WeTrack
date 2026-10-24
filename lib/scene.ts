import type { TaskPriority, TaskStatus } from "@/lib/db/enums"
import { projectProgress, workload } from "@/lib/dashboard"
import type { TaskRow } from "@/lib/queries"
import { type Health, health, type ProjectHealth } from "@/lib/schedule"
import { attachmentSrc } from "@/lib/utils"

// What the 3D overview (ProjectScene) draws. Plain JSON so it crosses the server/client line.
export type SceneProject = {
  id: string
  name: string
  color: string
  open: number
  total: number
  overdue: number
  progress: number
  health: ProjectHealth
  /** Its logo's URL, engraved on its token in place of initials. */
  logo: string | null
}
export type SceneTask = {
  id: string
  title: string
  status: TaskStatus
  project: string | null
  projectId: string | null
  assigneeId: string | null
  assignee: string | null
  priority: TaskPriority
  deadline: string | null
  /** Deadline health: overdue blocks get a red band, due-soon an amber one. */
  health: Health
}
export type SceneMember = {
  id: string
  name: string
  /** Their avatar, engraved on their token; initials until there is one. */
  image: string | null
  open: number
  active: number
  blocked: number
  overdue: number
}
// `counts` are the real totals per status; `tasks` is capped per lane, so labels read from counts.
export type SceneData = {
  /** The core token in the Hub: the workspace's logo, or its initials. */
  workspace: { name: string; logo: string | null }
  projects: SceneProject[]
  tasks: SceneTask[]
  counts: Record<TaskStatus, number>
  members: SceneMember[]
  /** Open work nobody owns yet: Team shows it on its own station, ready to hand out. */
  unassigned: SceneTask[]
}

export const MAX_PROJECTS = 24 // the Hub's two rings of tiles

const sceneTask = (t: TaskRow, today: string): SceneTask => ({
  id: t.id,
  title: t.title,
  status: t.status,
  project: t.project?.name ?? null,
  projectId: t.projectId,
  assigneeId: t.assigneeId,
  assignee: t.assignee?.name ?? null,
  priority: t.priority,
  deadline: t.deadline,
  health: health(t, today),
})

/**
 * Home shows a summary (`full` off): the 8 busiest projects, 12 tasks a lane, people with open work.
 * The workspace manages everything (`full` on): every project, 27 tasks a lane, everyone.
 */
export function sceneData(
  projects: { id: string; name: string; color: string; logoId?: string | null }[],
  tasks: TaskRow[],
  members: { id: string; name: string; image: string | null }[],
  today: string,
  { full = false, workspace }: { full?: boolean; workspace: SceneData["workspace"] }
): SceneData {
  const PER_STATUS = full ? 27 : 12
  const perStatus = new Map<TaskStatus, number>()
  const counts = { not_started: 0, in_progress: 0, review: 0, blocked: 0, completed: 0 }
  for (const t of tasks) counts[t.status]++
  return {
    workspace,
    counts,
    projects: projectProgress(projects, tasks, today, { keepEmpty: full })
      .slice(0, full ? MAX_PROJECTS : 8)
      .map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        open: p.open,
        total: p.total,
        overdue: p.overdue,
        progress: p.progress,
        health: p.health,
        logo: p.logoId ? attachmentSrc(p.logoId) : null,
      })),
    // listTasks is newest first, so each lane shows its most recently touched work.
    tasks: tasks
      .filter((t) => {
        const n = perStatus.get(t.status) ?? 0
        perStatus.set(t.status, n + 1)
        return n < PER_STATUS
      })
      .map((t) => sceneTask(t, today)),
    unassigned: tasks
      .filter((t) => !t.assigneeId && t.status !== "completed")
      .slice(0, 12)
      .map((t) => sceneTask(t, today)),
    members: workload(members, tasks, today)
      .filter((w) => full || w.open > 0)
      .sort((a, b) => b.open - a.open)
      .slice(0, full ? 16 : 8)
      .map((w) => ({
        id: w.member.id,
        name: w.member.name,
        image: w.member.image,
        open: w.open,
        active: w.active,
        blocked: w.blocked,
        overdue: w.overdue,
      })),
  }
}

// Sign-in has no session, so it shows this made-up workspace instead of anyone's real work.
export const SAMPLE_SCENE: SceneData = (() => {
  const projects: SceneProject[] = (
    [
      ["Website refresh", "#3b82f6", 9, 62, "on_track"],
      ["Mobile app", "#8b5cf6", 12, 41, "at_risk"],
      ["Billing", "#22c55e", 5, 78, "on_track"],
      ["Onboarding", "#f97316", 7, 35, "off_track"],
      ["Brand kit", "#ec4899", 3, 88, "on_track"],
      ["Help centre", "#06b6d4", 4, 54, "at_risk"],
    ] as const
  ).map(([name, color, open, progress, health], i) => ({
    id: `p${i + 1}`, name, color, open, total: open + 4, overdue: health === "off_track" ? 2 : 0, progress, health, logo: null,
  }))
  const lanes: [TaskStatus, number][] = [
    ["not_started", 10],
    ["in_progress", 7],
    ["review", 4],
    ["blocked", 2],
    ["completed", 12],
  ]
  const titles = ["Hero copy", "Pricing table", "Push alerts", "Invoice PDF", "Welcome email", "Logo grid", "Search", "Login flow"]
  let i = 0
  const tasks = lanes.flatMap(([status, n]) =>
    Array.from({ length: n }, () => {
      i++
      const p = projects[i % projects.length]
      // A few overdue, due-soon and urgent blocks, so the sign-in scene shows every signal.
      const due: SceneTask["health"] = status === "completed" ? "done" : i % 7 === 0 ? "overdue" : i % 5 === 0 ? "due_soon" : "on_track"
      return {
        id: `t${i}`, title: titles[i % titles.length], status, project: p.name, projectId: p.id,
        assigneeId: null, assignee: null, priority: i % 6 === 0 ? ("urgent" as const) : ("normal" as const), deadline: null, health: due,
      }
    })
  )
  const members: SceneMember[] = [
    { id: "m1", name: "Dara", image: null, open: 8, active: 3, blocked: 1, overdue: 1 },
    { id: "m2", name: "Sok", image: null, open: 6, active: 2, blocked: 0, overdue: 0 },
    { id: "m3", name: "Mina", image: null, open: 5, active: 2, blocked: 1, overdue: 2 },
    { id: "m4", name: "Vann", image: null, open: 4, active: 1, blocked: 0, overdue: 0 },
    { id: "m5", name: "Lina", image: null, open: 3, active: 1, blocked: 0, overdue: 0 },
  ]
  const counts = Object.fromEntries(lanes) as Record<TaskStatus, number>
  return { workspace: { name: "WeTrack", logo: null }, projects, tasks, counts, members, unassigned: tasks.filter((t) => t.status === "not_started").slice(0, 3) }
})()
