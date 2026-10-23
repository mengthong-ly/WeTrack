import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Reveal } from "@/components/motion-bits"
import { TaskDetail } from "@/components/task-detail"
import { getTask } from "@/lib/queries"
import { requireMember } from "@/lib/session"
import { loadTaskDetail } from "@/lib/task-detail"

export async function generateMetadata({ params }: PageProps<"/tasks/[id]">): Promise<Metadata> {
  const me = await requireMember()
  const task = await getTask(me.orgId, (await params).id)
  return { title: task?.title ?? "Task" }
}

export default async function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  const me = await requireMember()
  const detail = await loadTaskDetail(me, (await params).id)
  if (!detail) notFound()

  return (
    <Reveal className="mx-auto w-full max-w-3xl">
      <TaskDetail {...detail} />
    </Reveal>
  )
}
