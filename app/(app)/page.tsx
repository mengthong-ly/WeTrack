import { AlertTriangleIcon, CheckCircle2Icon, ClockIcon, InboxIcon } from "lucide-react"
import Link from "next/link"

import { ProjectDot } from "@/components/bits"
import { ProgressBar, Reveal } from "@/components/motion-bits"
import { StatTile } from "@/components/stat-tile"
import { TaskList } from "@/components/task-card"
import { STATUS } from "@/lib/labels"
import { listProjects, listTasks, recentActivity } from "@/lib/queries"
import { daysBetween, effectiveProgress, health, todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"
import { byDeadline, toCard } from "@/lib/task-view"
import { ago, greeting, longDate } from "@/lib/time"
import type { TaskStatus } from "@/lib/db/enums"

const ACTIVE: TaskStatus[] = ["in_progress", "review", "blocked"]

export default async function HomePage() {
  const me = await requireMember()
  const today = todayISO()
  const [tasks, projects, activity] = await Promise.all([
    listTasks(me.orgId),
    listProjects(me.orgId),
    recentActivity(me.orgId),
  ])

  const open = tasks.filter((t) => t.status !== "completed")
  const done = tasks.length - open.length
  const overdue = open.filter((t) => health(t, today) === "overdue").length
  const dueSoon = open.filter((t) => health(t, today) === "due_soon").length
  const dueThisWeek = open.filter((t) => t.deadline && daysBetween(today, t.deadline) <= 7).length
  const blocked = open.filter((t) => t.status === "blocked").length

  const focus = tasks.filter((t) => ACTIVE.includes(t.status)).sort(byDeadline)
  const upNext = open.filter((t) => !ACTIVE.includes(t.status)).sort(byDeadline).slice(0, 6)

  const projectStats = projects
    .map((p) => {
      const pt = tasks.filter((t) => t.projectId === p.id)
      const progress = pt.length ? Math.round(pt.reduce((s, t) => s + effectiveProgress(t), 0) / pt.length) : 0
      return { ...p, total: pt.length, open: pt.filter((t) => t.status !== "completed").length, progress }
    })
    .filter((p) => p.total > 0)
    .sort((a, b) => b.open - a.open)

  return (
    <div className="flex flex-col gap-8">
      <Reveal>
        <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
          {greeting()}, {me.user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-muted-foreground">{longDate()}</p>
      </Reveal>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
        <StatTile index={1} icon={InboxIcon} label="Open tasks" value={open.length} meta={`${dueThisWeek} this week`} />
        <StatTile
          index={2}
          icon={ClockIcon}
          label="In progress"
          value={focus.length}
          meta={blocked ? `${blocked} blocked` : "none blocked"}
          metaClassName={blocked ? "text-red-600" : undefined}
        />
        <StatTile index={3} icon={CheckCircle2Icon} label="Completed" value={done} meta={`out of ${tasks.length}`} />
        <StatTile
          index={4}
          icon={AlertTriangleIcon}
          label="Overdue"
          value={overdue}
          meta={dueSoon ? `${dueSoon} due soon` : "nothing due soon"}
          metaClassName={dueSoon ? "text-amber-600" : undefined}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Reveal index={5} className="flex flex-col gap-6 rounded-[2.5rem] bg-card p-3 shadow-sm sm:p-4 lg:col-span-2">
          <section>
            <h2 className="px-3 pt-2 pb-3 text-lg">Working on now</h2>
            <TaskList
              tasks={focus.map((t) => toCard(t, today))}
              empty={<Empty>Nothing in progress. Pick something from Up next.</Empty>}
            />
          </section>
          <section>
            <div className="flex items-baseline justify-between px-3 pb-3">
              <h2 className="text-lg">Up next</h2>
              <Link href="/tasks" className="text-sm text-muted-foreground hover:text-foreground">See all</Link>
            </div>
            <TaskList
              tasks={upNext.map((t) => toCard(t, today))}
              empty={<Empty>All clear. Press C to add a task.</Empty>}
            />
          </section>
        </Reveal>

        <div className="flex flex-col gap-6">
          <Reveal index={6} className="rounded-[2.5rem] bg-card p-6 shadow-sm">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg">Projects</h2>
              <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground">All</Link>
            </div>
            <ul className="mt-4 flex flex-col gap-4">
              {projectStats.map((p) => (
                <li key={p.id}>
                  <Link href={`/tasks?project=${p.id}`} className="group block">
                    <div className="flex items-center gap-2 text-sm">
                      <ProjectDot color={p.color} />
                      <span className="group-hover:underline">{p.name}</span>
                      <span className="ml-auto text-muted-foreground tabular">{p.progress}%</span>
                    </div>
                    <ProgressBar value={p.progress} className="mt-2" />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {p.open} open · {p.total - p.open} done
                    </p>
                  </Link>
                </li>
              ))}
              {projectStats.length === 0 && <li className="text-sm text-muted-foreground">No project activity yet.</li>}
            </ul>
          </Reveal>

          <Reveal index={7} className="rounded-[2.5rem] bg-card p-6 shadow-sm">
            <h2 className="text-lg">Recent activity</h2>
            <ul className="mt-4 flex flex-col gap-3.5">
              {activity.map((a) => (
                <li key={a.id} className="text-sm leading-snug">
                  <span className="text-foreground">{a.actor ?? "Someone"}</span>{" "}
                  <span className="text-muted-foreground">{describe(a.kind, a.data)}</span>{" "}
                  {a.taskId && (
                    <Link href={`/tasks/${a.taskId}`} className="hover:underline">{a.taskTitle}</Link>
                  )}
                  <span className="block text-xs text-muted-foreground">{ago(a.createdAt)}</span>
                </li>
              ))}
              {activity.length === 0 && <li className="text-sm text-muted-foreground">Nothing yet.</li>}
            </ul>
          </Reveal>
        </div>
      </div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[1.75rem] bg-muted/60 px-5 py-6 text-sm text-muted-foreground">{children}</p>
}

function describe(kind: string, data: Record<string, unknown> | null) {
  switch (kind) {
    case "task_created":
      return "added"
    case "task_completed":
      return "completed"
    case "status_changed":
      return `moved to ${STATUS[data?.to as TaskStatus]?.label.toLowerCase() ?? "a new status"}`
    case "deadline_changed":
      return "changed the deadline of"
    default:
      return "updated"
  }
}
