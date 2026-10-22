import type { TaskStatus } from "@/lib/db/enums"
import { projectProgress, workload } from "@/lib/dashboard"
import type { TaskRow } from "@/lib/queries"
import type { ProjectHealth } from "@/lib/schedule"

// What the 3D overview (ProjectScene) draws. Plain JSON so it crosses the server/client line.
export type SceneProject = { id: string; name: string; open: number; progress: number; health: ProjectHealth }
export type SceneTask = { id: string; title: string; status: TaskStatus; project: string | null }
export type SceneMember = { id: string; name: string; open: number; active: number; blocked: number; overdue: number }
// `counts` are the real totals per status; `tasks` is capped per lane, so labels read from counts.
export type SceneData = {
  projects: SceneProject[]
  tasks: SceneTask[]
  counts: Record<TaskStatus, number>
  members: SceneMember[]
}

const PER_STATUS = 12 // a lane holds 12 cubes before it gets too tall to read

export function sceneData(
  projects: { id: string; name: string; color: string }[],
  tasks: TaskRow[],
  members: { id: string; name: string }[],
  today: string
): SceneData {
  const perStatus = new Map<TaskStatus, number>()
  const counts = { not_started: 0, in_progress: 0, review: 0, blocked: 0, completed: 0 }
  for (const t of tasks) counts[t.status]++
  return {
    counts,
    projects: projectProgress(projects, tasks, today)
      .slice(0, 8)
      .map((p) => ({ id: p.id, name: p.name, open: p.open, progress: p.progress, health: p.health })),
    // listTasks is newest first, so each lane shows its most recently touched work.
    tasks: tasks
      .filter((t) => {
        const n = perStatus.get(t.status) ?? 0
        perStatus.set(t.status, n + 1)
        return n < PER_STATUS
      })
      .map((t) => ({ id: t.id, title: t.title, status: t.status, project: t.project?.name ?? null })),
    members: workload(members, tasks, today)
      .filter((w) => w.open > 0)
      .sort((a, b) => b.open - a.open)
      .slice(0, 8)
      .map((w) => ({
        id: w.member.id,
        name: w.member.name,
        open: w.open,
        active: w.active,
        blocked: w.blocked,
        overdue: w.overdue,
      })),
  }
}

// Sign-in has no session, so it shows this made-up workspace instead of anyone's real work.
export const SAMPLE_SCENE: SceneData = (() => {
  const projects: SceneProject[] = [
    { id: "p1", name: "Website refresh", open: 9, progress: 62, health: "on_track" },
    { id: "p2", name: "Mobile app", open: 12, progress: 41, health: "at_risk" },
    { id: "p3", name: "Billing", open: 5, progress: 78, health: "on_track" },
    { id: "p4", name: "Onboarding", open: 7, progress: 35, health: "off_track" },
    { id: "p5", name: "Brand kit", open: 3, progress: 88, health: "on_track" },
    { id: "p6", name: "Help centre", open: 4, progress: 54, health: "at_risk" },
  ]
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
      return { id: `t${i}`, title: titles[i % titles.length], status, project: projects[i % projects.length].name }
    })
  )
  const members: SceneMember[] = [
    { id: "m1", name: "Dara", open: 8, active: 3, blocked: 1, overdue: 1 },
    { id: "m2", name: "Sok", open: 6, active: 2, blocked: 0, overdue: 0 },
    { id: "m3", name: "Mina", open: 5, active: 2, blocked: 1, overdue: 2 },
    { id: "m4", name: "Vann", open: 4, active: 1, blocked: 0, overdue: 0 },
    { id: "m5", name: "Lina", open: 3, active: 1, blocked: 0, overdue: 0 },
  ]
  const counts = Object.fromEntries(lanes) as Record<TaskStatus, number>
  return { projects, tasks, counts, members }
})()
