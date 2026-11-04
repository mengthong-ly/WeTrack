import { Suspense } from "react"

import { DetailSkeleton } from "@/components/page-skeleton"
import { TaskDetail } from "@/components/task-detail"
import { DrawerTitle } from "@/components/ui/drawer"
import { LayerBody, RouteDrawer } from "@/components/workspace-drawer"
import { requireMember } from "@/lib/session"
import { loadNewTask } from "@/lib/task-detail"

// "New task" from a workspace panel opens the New task page in a drawer, over the scene.
export default function NewTaskPanel({ params, searchParams }: PageProps<"/projects/[projectId]/tasks/new">) {
  return (
    <RouteDrawer>
      <LayerBody className="p-4 sm:p-6">
        <DrawerTitle className="sr-only">New task</DrawerTitle>
        <Suspense fallback={<DetailSkeleton />}>
          <Panel params={params} searchParams={searchParams} />
        </Suspense>
      </LayerBody>
    </RouteDrawer>
  )
}

async function Panel({ params, searchParams }: Pick<PageProps<"/projects/[projectId]/tasks/new">, "params" | "searchParams">) {
  const { key, ...props } = await loadNewTask(await requireMember(), (await params).projectId, searchParams)
  return <TaskDetail key={key} {...props} inPanel />
}
