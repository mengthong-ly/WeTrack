import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ClientUpdateComposer, UpdateHistory } from "@/components/client-update-composer"
import { Reveal } from "@/components/motion-bits"
import { loadClientUpdates } from "@/lib/queries"
import { todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"

export const metadata: Metadata = { title: "Client updates" }

export default async function ClientUpdatesPage({
  params,
}: PageProps<"/projects/[projectId]/updates">) {
  const me = await requireMember()
  const { projectId } = await params
  const data = await loadClientUpdates(me.orgId, projectId)
  if (!data) notFound()
  const { project, items, history } = data

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <h1 className="text-3xl font-light tracking-tight sm:text-4xl">Client updates</h1>
        <p className="mt-1 text-muted-foreground">
          {history.rows[0] ? `Last update sent ${history.rows[0].when}` : "No updates sent yet"}
        </p>
      </Reveal>

      <Reveal
        index={1}
        className="rounded-sheet bg-card p-4 shadow-sm sm:p-6"
      >
        <h2 className="mb-4 text-lg">
          Not yet reported{" "}
          <span className="tabular text-muted-foreground">
            · {items.length}
          </span>
        </h2>
        <ClientUpdateComposer
          key={items.map((i) => `${i.taskId}:${i.ids.length}`).join()}
          projectId={project.id}
          projectName={project.name}
          items={items}
          today={todayISO()}
        />
      </Reveal>

      <Reveal
        index={2}
        className="rounded-sheet bg-card p-4 shadow-sm sm:p-6"
      >
        <h2 className="mb-4 text-lg">History</h2>
        <UpdateHistory projectId={project.id} latest={history.rows} total={history.total} />
      </Reveal>
    </div>
  )
}
