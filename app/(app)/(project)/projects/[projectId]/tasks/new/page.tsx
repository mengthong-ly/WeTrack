import type { Metadata } from "next"

import { Reveal } from "@/components/motion-bits"
import { TaskDetail } from "@/components/task-detail"
import { requireMember } from "@/lib/session"
import { loadNewTask } from "@/lib/task-detail"

export const metadata: Metadata = { title: "New task" }

export default async function NewTaskPage({ params, searchParams }: PageProps<"/projects/[projectId]/tasks/new">) {
  const { key, ...props } = await loadNewTask(await requireMember(), (await params).projectId, searchParams)
  return (
    <Reveal className="w-full">
      <TaskDetail key={key} {...props} />
    </Reveal>
  )
}
