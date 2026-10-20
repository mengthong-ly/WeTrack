import { AlertTriangleIcon, CheckCircle2Icon, ClockIcon, InboxIcon } from "lucide-react"
import Link from "next/link"

import { AttentionList } from "@/components/attention-list"
import { Reveal } from "@/components/motion-bits"
import { ProjectHealthList } from "@/components/project-health-list"
import { StatTile } from "@/components/stat-tile"
import { TaskList } from "@/components/task-card"
import { describeActivity } from "@/lib/activity-text"
import { needsAttention, projectProgress, summarize } from "@/lib/dashboard"
import { HEALTH, STATUS } from "@/lib/labels"
import { listProjects, listTasks, recentActivity } from "@/lib/queries"
import { todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"
import { toCard } from "@/lib/task-view"
import { ago, greeting, longDate } from "@/lib/time"

export default async function HomePage() {
  const me = await requireMember()
  const today = todayISO()
  const [tasks, projects, activity] = await Promise.all([
    listTasks(me.orgId),
    listProjects(me.orgId),
    recentActivity(me.orgId),
  ])

  const s = summarize(tasks, today)
  const focus = s.focus
  const upNext = s.upNext.slice(0, 6)
  const projectStats = projectProgress(projects, tasks, today)
  const attention = needsAttention(tasks, today)

  return (
    <div className="flex flex-col gap-8">
      <Reveal>
        <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
          {greeting()}, {me.user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-muted-foreground">{longDate()}</p>
      </Reveal>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
        <StatTile index={1} icon={InboxIcon} label="Open tasks" value={s.open} meta={`${s.dueThisWeek} this week`} />
        <StatTile
          index={2}
          icon={ClockIcon}
          label="In progress"
          value={focus.length}
          meta={s.blocked ? `${s.blocked} blocked` : "none blocked"}
          metaClassName={s.blocked ? STATUS.blocked.className : undefined}
        />
        <StatTile index={3} icon={CheckCircle2Icon} label="Done this week" value={s.doneThisWeek} meta={`${s.done} in total`} />
        <StatTile
          index={4}
          icon={AlertTriangleIcon}
          label="Overdue"
          value={s.overdue}
          meta={s.dueSoon ? `${s.dueSoon} due soon` : "nothing due soon"}
          metaClassName={s.dueSoon ? HEALTH.due_soon.className : undefined}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Reveal index={5} className="flex flex-col gap-6 rounded-sheet bg-card p-3 shadow-sm sm:p-4 lg:col-span-2">
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
          <Reveal index={6} className="rounded-sheet bg-card p-6 shadow-sm">
            <h2 className="flex items-baseline justify-between text-lg">
              Needs attention
              <span className="tabular text-sm text-muted-foreground">{attention.length}</span>
            </h2>
            <AttentionList items={attention} href={(id) => `/tasks/${id}`} />
          </Reveal>

          <Reveal index={7} className="rounded-sheet bg-card p-6 shadow-sm">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg">Projects</h2>
              <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground">All</Link>
            </div>
            <ProjectHealthList projects={projectStats} href={(id) => `/tasks?project=${id}`} />
          </Reveal>

          <Reveal index={8} className="rounded-sheet bg-card p-6 shadow-sm">
            <h2 className="text-lg">Recent activity</h2>
            <ul className="mt-4 flex flex-col gap-3.5">
              {activity.map((a) => (
                <li key={a.id} className="text-sm leading-snug">
                  <span className="text-foreground">{a.actor ?? "Someone"}</span>{" "}
                  <span className="text-muted-foreground">{describeActivity(a.kind, a.data)}</span>{" "}
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
  return <p className="rounded-card bg-muted/60 px-5 py-6 text-sm text-muted-foreground">{children}</p>
}

