import { cookies } from "next/headers"

import type { NewTaskPreset } from "@/components/command-menu"
import type { TaskDetailData } from "@/components/task-detail"
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/db/enums"
import { LAST_PROJECT_COOKIE, type MemberLite, type ProjectLite } from "@/lib/options"
import { getTask, listMembers, listProjects, meetingItems, taskComments, taskMeetings, taskTree } from "@/lib/queries"
import { daysLeft, health, releaseStage, todayISO } from "@/lib/schedule"
import type { requireMember } from "@/lib/session"
import { placeInTree } from "@/lib/task-tree"

type Me = Awaited<ReturnType<typeof requireMember>>

// Everything TaskDetail needs, for the task page and the workspace's task sheet. Null when not found.
export async function loadTaskDetail(me: Me, id: string) {
  const [task, projects, members, meetings, tree, comments] = await Promise.all([
    getTask(me.orgId, id),
    listProjects(me.orgId),
    listMembers(me.orgId),
    taskMeetings(me.orgId, id),
    taskTree(me.orgId),
    taskComments(me.orgId, id),
  ])
  if (!task) return null
  const { ancestors, family } = placeInTree(tree, task.id)
  const today = todayISO()
  const data: TaskDetailData = {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    type: task.type,
    progress: task.progress,
    startDate: task.startDate,
    deadline: task.deadline,
    projectId: task.projectId,
    assigneeId: task.assigneeId,
    health: health(task, today),
    daysLeft: daysLeft(task, today),
    createdAt: task.createdAt.toISOString(),
    release: task.release && { ...task.release, stage: releaseStage(task.release) },
    ancestors,
    family,
    subtasks: task.subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      priority: s.priority,
      deadline: s.deadline,
      assignee: s.assignee,
      subtasks: s.subtasks.length,
    })),
    // The latest page, newest first; the panel loads earlier ones.
    comments: comments.rows,
    commentTotal: comments.total,
  }
  return {
    task: data,
    projects: projects.map(({ id, name, color }) => ({ id, name, color })),
    members: members.map(({ id, name, image }) => ({ id, name, image })),
    // Every row is this task's, so drop the task line.
    meetings: meetingItems(meetings, members, { userId: me.user.id, email: me.user.email, role: me.role }).map((m) => ({ ...m, task: null })),
  }
}

// The New task page and the workspace's sheet (@panel/(..)tasks/new) both load this.
export async function loadNewTask(me: Me, searchParams: PageProps<"/tasks/new">["searchParams"]) {
  const [projects, members, query, jar] = await Promise.all([
    listProjects(me.orgId),
    listMembers(me.orgId),
    searchParams,
    cookies(),
  ])
  const one = (k: string) => (typeof query[k] === "string" ? query[k] : undefined)
  const has = (list: readonly string[], v?: string) => (v && list.includes(v) ? v : undefined)
  const projectLite: ProjectLite[] = projects.map(({ id, name, color }) => ({ id, name, color }))
  const memberLite: MemberLite[] = members.map(({ id, name, image }) => ({ id, name, image }))
  const ids = projectLite.map((p) => p.id)
  const preset: NewTaskPreset = {
    projectId: has(ids, one("projectId")) ?? has(ids, jar.get(LAST_PROJECT_COOKIE)?.value),
    assigneeId: has(memberLite.map((m) => m.id), one("assigneeId")),
    priority: has(TASK_PRIORITIES, one("priority")) as NewTaskPreset["priority"],
    status: has(TASK_STATUSES, one("status")) as NewTaskPreset["status"],
  }
  // A blank task for TaskDetail's draft mode, so New task is the task page before it exists.
  const task: TaskDetailData = {
    id: "",
    title: "",
    description: null,
    status: preset.status ?? "not_started",
    priority: preset.priority ?? "normal",
    type: "development",
    progress: 0,
    startDate: null,
    deadline: null,
    projectId: preset.projectId ?? projectLite[0]?.id ?? "",
    assigneeId: preset.assigneeId ?? me.user.id,
    health: "no_deadline",
    daysLeft: null,
    createdAt: new Date().toISOString(),
    release: null,
    ancestors: [],
    family: [],
    subtasks: [],
    comments: [],
    commentTotal: 0,
  }
  // A new preset is a new form, so the fields reset to it.
  return { key: JSON.stringify(preset), task, projects: projectLite, members: memberLite, meetings: [], draft: { meId: me.user.id } }
}
