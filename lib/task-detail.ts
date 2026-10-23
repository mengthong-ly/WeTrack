import type { TaskDetailData } from "@/components/task-detail"
import { getTask, listMembers, listProjects, meetingItems, taskMeetings } from "@/lib/queries"
import { daysLeft, health, releaseStage, todayISO } from "@/lib/schedule"
import type { requireMember } from "@/lib/session"

type Me = Awaited<ReturnType<typeof requireMember>>

// Everything TaskDetail needs, for the task page and the workspace's task sheet. Null when not found.
export async function loadTaskDetail(me: Me, id: string) {
  const [task, projects, members, meetings] = await Promise.all([
    getTask(me.orgId, id),
    listProjects(me.orgId),
    listMembers(me.orgId),
    taskMeetings(me.orgId, id),
  ])
  if (!task) return null
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
    subtasks: task.subtasks.map(({ id, title, done }) => ({ id, title, done })),
    comments: task.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      author: c.author,
    })),
  }
  return {
    task: data,
    projects: projects.map(({ id, name, color }) => ({ id, name, color })),
    members: members.map(({ id, name, image }) => ({ id, name, image })),
    // Every row is this task's, so drop the task line.
    meetings: meetingItems(meetings, members, { userId: me.user.id, email: me.user.email, role: me.role }).map((m) => ({ ...m, task: null })),
  }
}
