// What the agent API (REST routes and MCP) can read, as plain data. No HTTP here: callers map { error } themselves.
import { type AgentTask, compactTask, matchTasks, TASK_LIST_LIMIT } from "@/lib/agent-tasks"
import { type Attention, needsAttention, projectProgress, STALE_DAYS, summarize, workload } from "@/lib/dashboard"
import { LIST_LIMIT } from "@/lib/digest"
import { PROJECT_HEALTH } from "@/lib/labels"
import { listMembers, listProjects, listTasks, recentActivity, unreportedCounts } from "@/lib/queries"
import { doneThisWeek, todayISO } from "@/lib/schedule"

// The part of requireMember()'s result read here.
type Me = { orgId: string; orgName: string; user: { id: string; name: string } }

// Same wording as the Monday digest (app/api/cron/digest/route.ts).
const REASON: Record<Attention, string> = {
  overdue: "Overdue",
  blocked: "Blocked",
  stale: `No update in ${STALE_DAYS}+ days`,
  unassigned: "Nobody on it",
}

// ponytail: a project-scoped report filters this window of the latest activity; query by project if it comes up short.
const RECENT_WINDOW = 200

export type AgentReport = {
  workspace: string
  today: string
  you: { id: string; name: string }
  totals: { open: number; done: number; doneThisWeek: number; overdue: number; dueSoon: number; blocked: number }
  projects: {
    id: string
    name: string
    health: string
    open: number
    overdue: number
    progress: number
    unreportedClientChanges: number
  }[]
  people: {
    id: string
    name: string
    open: number
    active: number
    blocked: number
    overdue: number
    dueThisWeek: number
    doneThisWeek: number
  }[]
  attention: (AgentTask & { reason: string })[]
  doneThisWeek: AgentTask[]
  recent: { kind: string; task: string | null; actor: string | null; at: string }[]
}

// The workspace at a glance, composed like the Monday digest. With projectId, every part is that project's.
export async function agentReport(me: Me, projectId?: string): Promise<AgentReport | { error: string }> {
  const today = todayISO()
  const [allTasks, allProjects, members, activity, unreported] = await Promise.all([
    listTasks(me.orgId),
    listProjects(me.orgId),
    listMembers(me.orgId),
    recentActivity(me.orgId, projectId ? RECENT_WINDOW : LIST_LIMIT),
    unreportedCounts(me.orgId),
  ])
  const projects = projectId ? allProjects.filter((p) => p.id === projectId) : allProjects
  if (projectId && !projects.length) return { error: "Project not found." }
  const tasks = projectId ? allTasks.filter((t) => t.projectId === projectId) : allTasks
  const { open, done, doneThisWeek: doneCount, overdue, dueSoon, blocked } = summarize(tasks, today)

  return {
    workspace: me.orgName,
    today,
    you: { id: me.user.id, name: me.user.name },
    totals: { open, done, doneThisWeek: doneCount, overdue, dueSoon, blocked },
    projects: projectProgress(projects, tasks, today).map((p) => ({
      id: p.id,
      name: p.name,
      health: PROJECT_HEALTH[p.health].label,
      open: p.open,
      overdue: p.overdue,
      progress: p.progress,
      unreportedClientChanges: unreported.get(p.id) ?? 0,
    })),
    // Every member, so an idle teammate's id is still there to assign; only the counts follow the scope.
    people: workload(members, tasks, today).map(({ member, ...w }) => ({ id: member.id, name: member.name, ...w })),
    attention: needsAttention(tasks, today)
      .slice(0, LIST_LIMIT)
      .map(({ task, reason }) => ({ ...compactTask(task), reason: REASON[reason] })),
    doneThisWeek: tasks
      .filter((t) => doneThisWeek(t, today))
      .slice(0, LIST_LIMIT)
      .map(compactTask),
    recent: activity
      .filter((a) => !projectId || a.projectId === projectId)
      .slice(0, LIST_LIMIT)
      .map((a) => ({ kind: a.kind, task: a.taskTitle, actor: a.actor, at: a.createdAt.toISOString() })),
  }
}

export type TaskFilters = { q?: string; status?: string; project?: string; assignee?: string }

// Tasks in live projects, newest change first. assignee "me" is the caller.
export async function agentTasks(me: Me, f: TaskFilters): Promise<{ tasks: AgentTask[]; more: boolean }> {
  const rows = matchTasks(await listTasks(me.orgId), { ...f, assignee: f.assignee === "me" ? me.user.id : f.assignee })
  return { tasks: rows.slice(0, TASK_LIST_LIMIT).map(compactTask), more: rows.length > TASK_LIST_LIMIT }
}
