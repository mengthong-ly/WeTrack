import { Suspense } from "react"

import { DetailSkeleton } from "@/components/page-skeleton"
import { SheetTitle } from "@/components/ui/sheet"
import { TaskDetail } from "@/components/task-detail"
import { TaskSheet } from "@/components/workspace"
import { requireMember } from "@/lib/session"
import { loadNewTask } from "@/lib/task-detail"

// "New task" from a workspace panel opens the New task page in the side sheet, over the scene.
export default function NewTaskPanel({ searchParams }: PageProps<"/tasks/new">) {
  return (
    <TaskSheet>
      <SheetTitle className="sr-only">New task</SheetTitle>
      <Suspense fallback={<DetailSkeleton />}>
        <Panel searchParams={searchParams} />
      </Suspense>
    </TaskSheet>
  )
}

async function Panel({ searchParams }: Pick<PageProps<"/tasks/new">, "searchParams">) {
  const { key, ...props } = await loadNewTask(await requireMember(), searchParams)
  return <TaskDetail key={key} {...props} inPanel />
}
