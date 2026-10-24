import { notFound } from "next/navigation"
import { Suspense } from "react"

import { ClientUpdateComposer, UpdateHistory } from "@/components/client-update-composer"
import { DetailSkeleton } from "@/components/page-skeleton"
import { DrawerTitle } from "@/components/ui/drawer"
import { LayerBody, LayerHead, RouteDrawer } from "@/components/workspace-drawer"
import { loadClientUpdates } from "@/lib/queries"
import { todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"

// Client updates from a project's drawer: the same page, stacked over the project.
export default function ClientUpdatesPanel({ params }: PageProps<"/projects/[id]/updates">) {
  return (
    <RouteDrawer>
      <Suspense
        fallback={
          <LayerBody className="pt-6">
            <DrawerTitle className="sr-only">Client updates</DrawerTitle>
            <DetailSkeleton />
          </LayerBody>
        }
      >
        <Panel params={params} />
      </Suspense>
    </RouteDrawer>
  )
}

async function Panel({ params }: Pick<PageProps<"/projects/[id]/updates">, "params">) {
  const me = await requireMember()
  const data = await loadClientUpdates(me.orgId, (await params).id)
  if (!data) notFound()
  const { project, items, history } = data
  return (
    <>
      <LayerHead
        title="Client updates"
        description={
          <>
            <span>{project.name}</span>
            <span>{history.rows[0] ? `Last sent ${history.rows[0].when}` : "Nothing sent yet"}</span>
          </>
        }
      />
      <LayerBody className="flex flex-col gap-8">
        <section>
          <h2 className="mb-4 text-lg">
            Not yet reported <span className="tabular text-muted-foreground">· {items.length}</span>
          </h2>
          <ClientUpdateComposer
            key={items.map((i) => `${i.taskId}:${i.ids.length}`).join()}
            projectId={project.id}
            projectName={project.name}
            items={items}
            today={todayISO()}
          />
        </section>
        <section>
          <h2 className="mb-4 text-lg">History</h2>
          <UpdateHistory projectId={project.id} latest={history.rows} total={history.total} />
        </section>
      </LayerBody>
    </>
  )
}
