import type { Metadata } from "next"

import { PageTransition, Reveal } from "@/components/motion-bits"
import { TaskDetail } from "@/components/task-detail"
import { requireMember } from "@/lib/session"
import { loadNewTask } from "@/lib/task-detail"

export const metadata: Metadata = { title: "New task" }

export default async function NewTaskPage({ searchParams }: PageProps<"/tasks/new">) {
  const { key, ...props } = await loadNewTask(await requireMember(), searchParams)
  return (
    <PageTransition>
      <Reveal className="w-full">
        <TaskDetail key={key} {...props} />
      </Reveal>
    </PageTransition>
  )
}
