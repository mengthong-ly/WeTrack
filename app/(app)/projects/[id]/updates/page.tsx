import { ArrowLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { ProjectDot } from "@/components/bits"
import { ClientUpdateComposer } from "@/components/client-update-composer"
import { Reveal } from "@/components/motion-bits"
import { groupUpdates } from "@/lib/client-update"
import { clientUpdates, getProject, unreportedActivity } from "@/lib/queries"
import { todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"

export const metadata: Metadata = { title: "Client updates" }

export default async function ClientUpdatesPage({
  params,
}: PageProps<"/projects/[id]/updates">) {
  const me = await requireMember()
  const { id } = await params
  const project = await getProject(me.orgId, id)
  if (!project) notFound()
  const [events, history] = await Promise.all([
    unreportedActivity(me.orgId, id),
    clientUpdates(me.orgId, id),
  ])

  const items = groupUpdates(
    events.map((e) => ({
      id: e.id,
      kind: e.kind,
      taskId: e.taskId,
      createdAt: e.createdAt.toISOString(),
    })),
    events.map((e) => ({
      id: e.taskId!,
      title: e.title,
      status: e.status,
      deadline: e.deadline,
    }))
  )
  const fmt = (d: Date) =>
    d.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: process.env.APP_TIMEZONE ?? "Asia/Phnom_Penh",
    })

  return (
    <div className="flex flex-col gap-6">
      <Reveal className="flex flex-col gap-4">
        <Link
          href="/projects"
          aria-label="Back to projects"
          className="grid size-11 place-items-center rounded-full bg-card/70 ring-1 ring-foreground/5 backdrop-blur transition hover:bg-card"
        >
          <ArrowLeftIcon className="size-5" />
        </Link>
        <div>
          <p className="flex items-center gap-2 text-muted-foreground">
            <ProjectDot color={project.color} className="size-2.5" />
            {project.name}
          </p>
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
            Client updates
          </h1>
          <p className="mt-1 text-muted-foreground">
            {history[0]
              ? `Last update sent ${fmt(history[0].createdAt)}`
              : "No updates sent yet"}
          </p>
        </div>
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
        <ul className="flex flex-col gap-2">
          {history.map((h) => (
            <li key={h.id}>
              <details className="group rounded-row bg-muted/70 px-4 py-3.5">
                <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3">
                  <span>{fmt(h.createdAt)}</span>
                  <span className="text-sm text-muted-foreground">
                    {h.itemCount} item{h.itemCount === 1 ? "" : "s"} ·{" "}
                    {h.sentBy ?? "Former member"}
                  </span>
                </summary>
                <p className="mt-3 text-sm whitespace-pre-wrap text-muted-foreground">
                  {h.message}
                </p>
              </details>
            </li>
          ))}
          {history.length === 0 && (
            <li className="text-sm text-muted-foreground">
              Sent updates will be listed here.
            </li>
          )}
        </ul>
      </Reveal>
    </div>
  )
}
