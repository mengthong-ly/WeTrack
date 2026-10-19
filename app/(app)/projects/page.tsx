import type { Metadata } from "next"
import Link from "next/link"

import { ProjectDot } from "@/components/bits"
import { CountUp, ProgressBar, Reveal } from "@/components/motion-bits"
import { NewProject } from "@/components/new-project"
import { formatDate } from "@/lib/labels"
import { listProjects, listTasks } from "@/lib/queries"
import { effectiveProgress, health, todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"
import { byDeadline } from "@/lib/task-view"

export const metadata: Metadata = { title: "Projects" }

export default async function ProjectsPage() {
  const me = await requireMember()
  const today = todayISO()
  const [projects, tasks] = await Promise.all([listProjects(me.orgId), listTasks(me.orgId)])

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <h1 className="text-3xl font-light tracking-tight sm:text-4xl">Projects</h1>
        <p className="mt-1 text-muted-foreground">Clients and products you&apos;re building for.</p>
      </Reveal>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p, i) => {
          const pt = tasks.filter((t) => t.projectId === p.id)
          const open = pt.filter((t) => t.status !== "completed")
          const overdue = open.filter((t) => health(t, today) === "overdue").length
          const progress = pt.length ? Math.round(pt.reduce((s, t) => s + effectiveProgress(t), 0) / pt.length) : 0
          const next = open.filter((t) => t.deadline).sort(byDeadline)[0]
          return (
            <Reveal key={p.id} index={i + 1}>
              <Link
                href={`/tasks?project=${p.id}`}
                className="flex h-full min-h-48 flex-col rounded-[2rem] bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <ProjectDot color={p.color} className="size-2.5" />
                  <span className="text-lg">{p.name}</span>
                </div>
                <span className="mt-auto pt-6 text-5xl font-light tracking-tight">
                  <CountUp value={progress} suffix="%" />
                </span>
                <ProgressBar value={progress} className="mt-3" />
                <p className="mt-3 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                  <span>{open.length} open</span>
                  <span>{pt.length - open.length} done</span>
                  {overdue > 0 && <span className="text-red-600">{overdue} overdue</span>}
                  {next && <span>next due {formatDate(next.deadline)}</span>}
                </p>
              </Link>
            </Reveal>
          )
        })}
        <Reveal index={projects.length + 1}>
          <NewProject />
        </Reveal>
      </div>
    </div>
  )
}
