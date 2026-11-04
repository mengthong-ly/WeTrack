import { SendIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { HealthBadge } from "@/components/bits"
import { CountUp, ProgressBar, Reveal } from "@/components/motion-bits"
import { TaskList } from "@/components/task-card"
import { summarize } from "@/lib/dashboard"
import { formatDate, HEALTH, STATUS } from "@/lib/labels"
import { getProject, listTasks, unreportedCounts } from "@/lib/queries"
import { tasksHref, updatesHref } from "@/lib/routes"
import { effectiveProgress, projectHealth, todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"
import { toCard } from "@/lib/task-view"
import { cn } from "@/lib/utils"

export async function generateMetadata({ params }: PageProps<"/projects/[projectId]">): Promise<Metadata> {
  const me = await requireMember()
  return { title: (await getProject(me.orgId, (await params).projectId))?.name ?? "Project" }
}

// A project's first page in task mode: what you're on here and what's next, beside how the project is doing.
export default async function ProjectOverview({ params }: PageProps<"/projects/[projectId]">) {
  const me = await requireMember()
  const today = todayISO()
  const { projectId } = await params
  const [project, all, unreported] = await Promise.all([getProject(me.orgId, projectId), listTasks(me.orgId), unreportedCounts(me.orgId)])
  if (!project) notFound()
  const tasks = all.filter((t) => t.projectId === projectId)
  const mine = tasks.filter((t) => t.assigneeId === me.user.id)

  const s = summarize(mine, today)
  const p = summarize(tasks, today)
  const [now, ...upNext] = [...s.focus, ...s.upNext].slice(0, 5).map((t) => toCard(t, today))
  const progress = tasks.length ? Math.round(tasks.reduce((n, t) => n + effectiveProgress(t), 0) / tasks.length) : 0
  const next = p.upNext.find((t) => t.deadline) ?? p.focus.find((t) => t.deadline)
  const toTell = unreported.get(projectId) ?? 0

  const facts = [
    { n: s.focus.length, label: "in progress" },
    { n: s.dueThisWeek, label: "due this week" },
    { n: s.overdue, label: "overdue", className: HEALTH.overdue.className },
    { n: s.blocked, label: "blocked", className: STATUS.blocked.className },
  ].filter((f, i) => i < 2 || f.n > 0)

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <h1 className="text-3xl font-light tracking-tight sm:text-4xl">{project.name}</h1>
        {project.description && <p className="mt-2 max-w-2xl whitespace-pre-line text-muted-foreground">{project.description}</p>}
        <p className="mt-1 text-muted-foreground">
          Yours here
          {facts.map((f) => (
            <span key={f.label}>
              <span aria-hidden> · </span>
              <span className={cn("tabular text-foreground", f.n > 0 && f.className)}>{f.n}</span> {f.label}
            </span>
          ))}
        </p>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <Reveal index={1} className="rounded-sheet bg-card p-3 shadow-sm sm:p-4">
          <div className="flex items-baseline justify-between px-3 pt-2 pb-3">
            <h2 className="text-lg">Continue</h2>
            <Link href={tasksHref(projectId)} className="text-sm text-muted-foreground hover:text-foreground">
              All tasks
            </Link>
          </div>
          <TaskList
            tasks={now ? [now] : []}
            empty={
              <p className="rounded-card bg-muted/60 px-5 py-6 text-sm text-muted-foreground">
                Nothing of yours in {project.name}. Press C to add a task.
              </p>
            }
          />
          {upNext.length > 0 && (
            <>
              <h3 className="px-3 pt-5 pb-2 text-sm text-muted-foreground">Up next</h3>
              <TaskList compact tasks={upNext} />
            </>
          )}
        </Reveal>

        {/* How the whole project is doing, everyone's work. */}
        <Reveal index={2} className="flex flex-col gap-3 rounded-sheet bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg">Progress</h2>
            {tasks.length > 0 && <HealthBadge health={projectHealth(tasks, today)} />}
          </div>
          <span className="font-heading text-5xl font-light tracking-tight">
            <CountUp value={progress} suffix="%" />
          </span>
          <ProgressBar value={progress} />
          <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
            <span className="tabular">{p.open} open</span>
            <span className="tabular">{p.done} done</span>
            {p.overdue > 0 && <span className={cn("tabular", HEALTH.overdue.className)}>{p.overdue} overdue</span>}
            {next?.deadline && <span>next due {formatDate(next.deadline)}</span>}
          </p>
          <Link
            href={updatesHref(projectId)}
            className="mt-2 flex h-11 items-center gap-2 rounded-row bg-muted/60 px-3 text-sm transition-[background-color,scale] hover:bg-muted active:scale-99"
          >
            <SendIcon className="size-4 text-muted-foreground" />
            Client updates
            <span className="ml-auto text-muted-foreground">{toTell ? `${toTell} to tell` : "Up to date"}</span>
          </Link>
        </Reveal>
      </div>
    </div>
  )
}
