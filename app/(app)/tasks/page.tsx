import type { Metadata } from "next"

import { ProjectDot } from "@/components/bits"
import { Reveal } from "@/components/motion-bits"
import { PillTabs } from "@/components/pill-tabs"
import { TaskList } from "@/components/task-card"
import { listProjects, listTasks, type TaskRow } from "@/lib/queries"
import { daysBetween, todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"
import { byDeadline, toCard } from "@/lib/task-view"

export const metadata: Metadata = { title: "Tasks" }

const VIEWS = {
  open: { label: "Open", match: (t: TaskRow) => t.status !== "completed" },
  mine: { label: "Mine", match: (t: TaskRow, me: string) => t.status !== "completed" && t.assigneeId === me },
  active: { label: "In progress", match: (t: TaskRow) => ["in_progress", "review", "blocked"].includes(t.status) },
  done: { label: "Completed", match: (t: TaskRow) => t.status === "completed" },
  all: { label: "All", match: () => true },
} as const
type View = keyof typeof VIEWS

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const me = await requireMember()
  const sp = await searchParams
  const view: View = typeof sp.view === "string" && sp.view in VIEWS ? (sp.view as View) : "open"
  const projectId = typeof sp.project === "string" ? sp.project : undefined
  const today = todayISO()

  const [tasks, projects] = await Promise.all([listTasks(me.orgId), listProjects(me.orgId)])
  const shown = tasks
    .filter((t) => VIEWS[view].match(t, me.user.id) && (!projectId || t.projectId === projectId))
    .sort(view === "done" ? (a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0) : byDeadline)

  const href = (next: { view?: View; project?: string | null }) => {
    const p = new URLSearchParams()
    const v = next.view ?? view
    const pr = next.project === undefined ? projectId : next.project
    if (v !== "open") p.set("view", v)
    if (pr) p.set("project", pr)
    const q = p.toString()
    return q ? `/tasks?${q}` : "/tasks"
  }

  const groups =
    view === "done"
      ? [{ title: "Completed", tasks: shown }]
      : [
          { title: "Overdue", tasks: shown.filter((t) => t.status !== "completed" && t.deadline && t.deadline < today) },
          { title: "This week", tasks: shown.filter((t) => t.status !== "completed" && t.deadline && t.deadline >= today && daysBetween(today, t.deadline) <= 7) },
          { title: "Later", tasks: shown.filter((t) => t.status !== "completed" && t.deadline && daysBetween(today, t.deadline) > 7) },
          { title: "No deadline", tasks: shown.filter((t) => t.status !== "completed" && !t.deadline) },
          { title: "Completed", tasks: shown.filter((t) => t.status === "completed") },
        ].filter((g) => g.tasks.length > 0)

  return (
    <div className="flex flex-col gap-6">
      <Reveal className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl">Tasks</h1>
          <span className="text-muted-foreground tabular">{shown.length}</span>
        </div>
        <PillTabs
          id="view"
          className="self-start"
          items={(Object.keys(VIEWS) as View[]).map((v) => ({ href: href({ view: v }), label: VIEWS[v].label, active: v === view }))}
        />
        {projects.length > 0 && (
          <PillTabs
            id="project"
            className="self-start"
            items={[
              { href: href({ project: null }), label: "All projects", active: !projectId },
              ...projects.map((p) => ({
                href: href({ project: p.id }),
                label: (
                  <>
                    <ProjectDot color={p.color} />
                    {p.name}
                  </>
                ),
                active: p.id === projectId,
              })),
            ]}
          />
        )}
      </Reveal>

      <Reveal index={1} className="flex flex-col gap-6 rounded-[2.5rem] bg-card p-3 shadow-sm sm:p-4">
        {groups.map((g) => (
          <section key={g.title}>
            <h2 className="flex items-baseline justify-between px-3 pt-2 pb-3 text-lg">
              {g.title}
              <span className="text-sm text-muted-foreground tabular">{g.tasks.length}</span>
            </h2>
            <TaskList tasks={g.tasks.map((t) => toCard(t, today))} />
          </section>
        ))}
        {groups.length === 0 && (
          <p className="px-5 py-12 text-center text-muted-foreground">No tasks here. Press C to add one.</p>
        )}
      </Reveal>
    </div>
  )
}
