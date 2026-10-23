import { notFound } from "next/navigation"
import { Suspense } from "react"

import { DetailSkeleton } from "@/components/page-skeleton"
import { TaskDetail } from "@/components/task-detail"
import { SheetTitle } from "@/components/ui/sheet"
import { TaskSheet } from "@/components/workspace"
import { requireMember } from "@/lib/session"
import { loadTaskDetail } from "@/lib/task-detail"

// The sheet slides in on the click; the task streams into it.
export default function TaskPanel({ params }: PageProps<"/tasks/[id]">) {
  return (
    <TaskSheet>
      <Suspense
        fallback={
          <>
            <SheetTitle className="sr-only">Loading task</SheetTitle>
            <DetailSkeleton />
          </>
        }
      >
        <Panel params={params} />
      </Suspense>
    </TaskSheet>
  )
}

async function Panel({ params }: Pick<PageProps<"/tasks/[id]">, "params">) {
  const me = await requireMember()
  const detail = await loadTaskDetail(me, (await params).id)
  if (!detail) notFound()
  return (
    <>
      <SheetTitle className="sr-only">{detail.task.title}</SheetTitle>
      <TaskDetail {...detail} inPanel />
    </>
  )
}
