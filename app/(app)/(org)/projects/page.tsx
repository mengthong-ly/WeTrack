import type { Metadata } from "next"
import { Suspense } from "react"

import { Reveal } from "@/components/motion-bits"
import { ProjectTable } from "@/components/project-table"
import { summarize } from "@/lib/dashboard"
import { formatDate, HEALTH, STATUS } from "@/lib/labels"
import { listProjects, listTasks, unreportedCounts } from "@/lib/queries"
import { effectiveProgress, health, projectHealth, todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"
import { assignedTo, byDeadline } from "@/lib/task-view"
import { greeting, longDate } from "@/lib/time"
import { attachmentSrc, cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Projects" }

// Project selection mode's home and where everyone lands: your day in one line, then every project as a data table
// row to step into (task mode). Tasks are only ever worked on inside a project; meetings have their own page.
export default async function ProjectsPage() {
  const me = await requireMember()
  const today = todayISO()
  const [projects, tasks, unreported] = await Promise.all([listProjects(me.orgId), listTasks(me.orgId), unreportedCounts(me.orgId)])
  const s = summarize(
    tasks.filter((t) => assignedTo(t, me.user.id)),
    today
  )
  const facts = [
    { n: s.focus.length, label: "in progress" },
    { n: s.dueThisWeek, label: "due this week" },
    { n: s.overdue, label: "overdue", className: HEALTH.overdue.className },
    { n: s.blocked, label: "blocked", className: STATUS.blocked.className },
  ].filter((f, i) => i < 2 || f.n > 0)

  return (
    <Reveal className="flex flex-col gap-6">
      <Suspense>
        <ProjectTable
          greeting={
            <>
              {greeting()}, {me.user.name.split(" ")[0]}. {longDate()}
              {facts.map((f) => (
                <span key={f.label}>
                  <span aria-hidden> · </span>
                  <span className={cn("tabular text-foreground", f.n > 0 && f.className)}>{f.n}</span> {f.label}
                </span>
              ))}
            </>
          }
          projects={projects.map((p) => {
            const pt = tasks.filter((t) => t.projectId === p.id)
            const open = pt.filter((t) => t.status !== "completed")
            const next = open.filter((t) => t.deadline).sort(byDeadline)[0]
            return {
              id: p.id,
              name: p.name,
              color: p.color,
              logo: p.logoId && attachmentSrc(p.logoId),
              health: pt.length ? projectHealth(pt, today) : null,
              progress: pt.length ? Math.round(pt.reduce((n, t) => n + effectiveProgress(t), 0) / pt.length) : 0,
              open: open.length,
              done: pt.length - open.length,
              yours: open.filter((t) => assignedTo(t, me.user.id)).length,
              overdue: open.filter((t) => health(t, today) === "overdue").length,
              nextDue: next?.deadline ? formatDate(next.deadline) : null,
              nextDueOn: next?.deadline ?? null,
              toTell: unreported.get(p.id) ?? 0,
            }
          })}
        />
      </Suspense>
    </Reveal>
  )
}
