import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Reveal } from "@/components/motion-bits"
import { TaskDetail } from "@/components/task-detail"
import { getTask, listMembers, listProjects, meetingItems, taskMeetings } from "@/lib/queries"
import { daysLeft, health, releaseStage, todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"

export async function generateMetadata({ params }: PageProps<"/tasks/[id]">): Promise<Metadata> {
  const me = await requireMember()
  const task = await getTask(me.orgId, (await params).id)
  return { title: task?.title ?? "Task" }
}

export default async function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  const me = await requireMember()
  const { id } = await params
  const [task, projects, members, meetings] = await Promise.all([
    getTask(me.orgId, id),
    listProjects(me.orgId),
    listMembers(me.orgId),
    taskMeetings(me.orgId, id),
  ])
  if (!task) notFound()
  const today = todayISO()

  return (
    <Reveal className="mx-auto w-full max-w-3xl">
      <TaskDetail
        task={{
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
        }}
        projects={projects.map(({ id, name, color }) => ({ id, name, color }))}
        members={members.map(({ id, name, image }) => ({ id, name, image }))}
        // Every row is this task's, so drop the task line.
        meetings={meetingItems(meetings, members, { userId: me.user.id, email: me.user.email, role: me.role }).map((m) => ({ ...m, task: null }))}
      />
    </Reveal>
  )
}
