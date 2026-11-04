import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { Reveal } from "@/components/motion-bits"
import { TaskDetail } from "@/components/task-detail"
import { getTask } from "@/lib/queries"
import { taskHref } from "@/lib/routes"
import { requireMember } from "@/lib/session"
import { loadTaskDetail } from "@/lib/task-detail"

export async function generateMetadata({ params }: PageProps<"/projects/[projectId]/tasks/[taskId]">): Promise<Metadata> {
  const me = await requireMember()
  const task = await getTask(me.orgId, (await params).taskId)
  return { title: task?.title ?? "Task" }
}

export default async function TaskPage({ params }: PageProps<"/projects/[projectId]/tasks/[taskId]">) {
  const me = await requireMember()
  const { projectId, taskId } = await params
  const detail = await loadTaskDetail(me, taskId)
  if (!detail) notFound()
  // Moved to another project: open it there, so the sidebar shows the project it's in.
  if (detail.task.projectId !== projectId) redirect(taskHref(detail.task.projectId, taskId))

  return (
    <Reveal className="w-full">
      <TaskDetail {...detail} />
    </Reveal>
  )
}
