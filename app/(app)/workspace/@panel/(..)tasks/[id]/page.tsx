import { notFound } from "next/navigation"

import { TaskDetail } from "@/components/task-detail"
import { TaskSheet } from "@/components/workspace"
import { requireMember } from "@/lib/session"
import { loadTaskDetail } from "@/lib/task-detail"

export default async function TaskPanel({ params }: PageProps<"/tasks/[id]">) {
  const me = await requireMember()
  const detail = await loadTaskDetail(me, (await params).id)
  if (!detail) notFound()

  return (
    <TaskSheet title={detail.task.title}>
      <TaskDetail {...detail} inPanel />
    </TaskSheet>
  )
}
