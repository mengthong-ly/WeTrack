import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  EyeIcon,
  InboxIcon,
} from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ProjectDot, UserAvatar } from "@/components/bits"
import { Logo } from "@/components/logo"
import { ProgressBar, Reveal } from "@/components/motion-bits"
import { PillTabs } from "@/components/pill-tabs"
import { StatTile } from "@/components/stat-tile"
import { TaskList } from "@/components/task-card"
import { describeActivity } from "@/lib/activity-text"
import { projectProgress, summarize } from "@/lib/dashboard"
import { formatDate, HEALTH } from "@/lib/labels"
import {
  listMembers,
  listProjects,
  listTasks,
  recentActivity,
} from "@/lib/queries"
import { health, todayISO } from "@/lib/schedule"
import { resolveShareLink } from "@/lib/share"
import { toCard } from "@/lib/task-view"
import { ago, longDate } from "@/lib/time"

// The link itself is the credential: keep it out of search engines and Referer headers.
export const metadata: Metadata = {
  title: "Progress",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default async function SharedDashboard({
  params,
  searchParams,
}: PageProps<"/r/[token]">) {
  const { token } = await params
  const link = await resolveShareLink(token)
  if (!link) notFound()

  const sp = await searchParams
  const today = todayISO()
  const [allTasks, projects, members] = await Promise.all([
    listTasks(link.orgId),
    listProjects(link.orgId),
    listMembers(link.orgId),
  ])
  const person = members.find((m) => m.id === sp.person)
  const tasks = person
    ? allTasks.filter((t) => t.assigneeId === person.id)
    : allTasks
  const activity = await recentActivity(link.orgId, 10, person?.id)

  const s = summarize(tasks, today)
  const base = `/r/${token}`
  const people = person ? [person] : members
  const focusByPerson = [
    ...people.map((m) => ({
      key: m.id,
      who: m as { name: string; image: string | null } | null,
      tasks: s.focus.filter((t) => t.assigneeId === m.id),
    })),
    ...(person
      ? []
      : [
          {
            key: "none",
            who: null,
            tasks: s.focus.filter((t) => !t.assigneeId),
          },
        ]),
  ].filter((g) => g.tasks.length > 0)
  const deadlines = s.upNext
    .concat(s.focus)
    .filter((t) => t.deadline)
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!))
    .slice(0, 8)

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-8 sm:pt-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <Logo className="text-3xl sm:text-4xl" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-card/70 px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-foreground/5">
          <EyeIcon className="size-3.5" />
          Read-only
        </span>
      </header>

      <div className="flex flex-col gap-8">
        <Reveal>
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
            {link.orgName} · development progress
          </h1>
          <p className="mt-1 text-muted-foreground">As of {longDate()}</p>
        </Reveal>

        {members.length > 1 && (
          <Reveal index={1}>
            <PillTabs
              id="person"
              className="self-start"
              items={[
                { href: base, label: "Everyone", active: !person },
                ...members.map((m) => ({
                  href: `${base}?person=${m.id}`,
                  label: (
                    <>
                      <UserAvatar user={m} className="size-5 ring-0" />
                      {m.name.split(" ")[0]}
                    </>
                  ),
                  active: m.id === person?.id,
                })),
              ]}
            />
          </Reveal>
        )}

        <section
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          aria-label="Summary"
        >
          <StatTile
            index={2}
            icon={InboxIcon}
            label="Open tasks"
            value={s.open}
            meta={`${s.dueThisWeek} due this week`}
          />
          <StatTile
            index={3}
            icon={ClockIcon}
            label="In progress"
            value={s.focus.length}
            meta={s.blocked ? `${s.blocked} blocked` : "none blocked"}
            metaClassName={s.blocked ? "text-red-600" : undefined}
          />
          <StatTile
            index={4}
            icon={CheckCircle2Icon}
            label="Completed"
            value={s.done}
            meta={`out of ${s.total}`}
          />
          <StatTile
            index={5}
            icon={AlertTriangleIcon}
            label="Overdue"
            value={s.overdue}
            meta={s.dueSoon ? `${s.dueSoon} due soon` : "nothing due soon"}
            metaClassName={s.dueSoon ? "text-amber-600" : undefined}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <Reveal
            index={6}
            className="flex flex-col gap-6 rounded-sheet bg-card p-3 shadow-sm sm:p-4 lg:col-span-2"
          >
            <h2 className="px-3 pt-2 text-lg">Working on now</h2>
            {focusByPerson.map((g) => (
              <section key={g.key}>
                <h3 className="flex items-center gap-2 px-3 pb-3 text-sm text-muted-foreground">
                  {g.who ? (
                    <UserAvatar user={g.who} className="size-6 ring-0" />
                  ) : null}
                  {g.who?.name ?? "Unassigned"}
                  <span className="tabular">· {g.tasks.length}</span>
                </h3>
                <TaskList
                  readOnly
                  tasks={g.tasks.map((t) => toCard(t, today))}
                />
              </section>
            ))}
            {focusByPerson.length === 0 && (
              <p className="rounded-card bg-muted/60 px-5 py-6 text-sm text-muted-foreground">
                Nothing in progress right now.
              </p>
            )}
          </Reveal>

          <div className="flex flex-col gap-6">
            <Reveal
              index={7}
              className="rounded-sheet bg-card p-6 shadow-sm"
            >
              <h2 className="text-lg">Upcoming deadlines</h2>
              <ul className="mt-4 flex flex-col gap-3">
                {deadlines.map((t) => {
                  const h = HEALTH[health(t, today)]
                  return (
                    <li
                      key={t.id}
                      className="flex items-baseline gap-3 text-sm"
                    >
                      <span className="tabular w-14 shrink-0 text-muted-foreground">
                        {formatDate(t.deadline)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{t.title}</span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <ProjectDot color={t.project.color} />
                          {t.project.name}
                          {(h.label === "Overdue" ||
                            h.label === "Due soon") && (
                            <span className={h.className}>· {h.label}</span>
                          )}
                        </span>
                      </span>
                    </li>
                  )
                })}
                {deadlines.length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    No dated work coming up.
                  </li>
                )}
              </ul>
            </Reveal>

            <Reveal
              index={8}
              className="rounded-sheet bg-card p-6 shadow-sm"
            >
              <h2 className="text-lg">Projects</h2>
              <ul className="mt-4 flex flex-col gap-4">
                {projectProgress(projects, tasks).map((p) => (
                  <li key={p.id}>
                    <div className="flex items-center gap-2 text-sm">
                      <ProjectDot color={p.color} />
                      {p.name}
                      <span className="tabular ml-auto text-muted-foreground">
                        {p.progress}%
                      </span>
                    </div>
                    <ProgressBar value={p.progress} className="mt-2" />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {p.open} open · {p.total - p.open} done
                    </p>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal
              index={9}
              className="rounded-sheet bg-card p-6 shadow-sm"
            >
              <h2 className="text-lg">Recent activity</h2>
              <ul className="mt-4 flex flex-col gap-3.5">
                {activity.map((a) => (
                  <li key={a.id} className="text-sm leading-snug">
                    <span>{a.actor ?? "Someone"}</span>{" "}
                    <span className="text-muted-foreground">
                      {describeActivity(a.kind, a.data)}
                    </span>{" "}
                    {a.taskTitle}
                    <span className="block text-xs text-muted-foreground">
                      {ago(a.createdAt)}
                    </span>
                  </li>
                ))}
                {activity.length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    Nothing yet.
                  </li>
                )}
              </ul>
            </Reveal>
          </div>
        </div>
      </div>
    </main>
  )
}
