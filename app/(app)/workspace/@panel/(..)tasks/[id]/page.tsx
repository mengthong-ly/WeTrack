import { notFound } from "next/navigation"
import { Suspense } from "react"

import { DetailSkeleton } from "@/components/page-skeleton"
import { TaskDetail } from "@/components/task-detail"
import { DrawerTitle } from "@/components/ui/drawer"
import { LayerBody, RouteDrawer } from "@/components/workspace-drawer"
import { requireMember } from "@/lib/session"
import { loadTaskDetail } from "@/lib/task-detail"

// The sheet slides in on the click; the task streams into it.
export default function TaskPanel({ params }: PageProps<"/tasks/[id]">) {
  return (
    <RouteDrawer>
      <LayerBody className="p-4 sm:p-6">
        <Suspense
          fallback={
            <>
              <DrawerTitle className="sr-only">Loading task</DrawerTitle>
              <DetailSkeleton />
            </>
          }
        >
          <Panel params={params} />
        </Suspense>
      </LayerBody>
    </RouteDrawer>
  )
}

async function Panel({ params }: Pick<PageProps<"/tasks/[id]">, "params">) {
  const me = await requireMember()
  const detail = await loadTaskDetail(me, (await params).id)
  if (!detail) notFound()
  return (
    <>
      <DrawerTitle className="sr-only">{detail.task.title}</DrawerTitle>
      <TaskDetail {...detail} inPanel />
    </>
  )
}
