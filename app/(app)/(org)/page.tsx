import {
  BellDotIcon,
  CalendarClockIcon,
  LayoutDashboardIcon,
  TriangleAlertIcon,
  ZapIcon,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { ActivityRow } from "@/components/activity-row"
import { PageHead } from "@/components/data-table"
import { Reveal } from "@/components/motion-bits"
import { QuickActions } from "@/components/quick-actions"
import { StatTile } from "@/components/stat-tile"
import { UnseenList } from "@/components/unseen-list"
import { summarize } from "@/lib/dashboard"
import { HEALTH } from "@/lib/labels"
import {
  listTasks,
  previousLogin,
  recentActivity,
  unseenTasks,
} from "@/lib/queries"
import { todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"
import { assignedTo } from "@/lib/task-view"
import { ago, dateTime, greeting, longDate } from "@/lib/time"

export const metadata: Metadata = { title: "Home" }

// Where you land: shortcuts for what you start most, how your own work stands, what changed on your tasks since you last
// opened them, and what the team has been doing. Projects, with the full list, are one click away.
export default async function Home() {
  const me = await requireMember()
  const today = todayISO()
  const now = new Date()
  const [tasks, unseen, activity, lastLogin] = await Promise.all([
    listTasks(me.orgId),
    unseenTasks(me.orgId, me.user.id),
    recentActivity(me.orgId, 5),
    previousLogin(me.user.id),
  ])
  const mine = summarize(
    tasks.filter((t) => assignedTo(t, me.user.id)),
    today
  )

  return (
    <Reveal className="flex flex-col gap-6">
      <PageHead
        icon={<LayoutDashboardIcon />}
        tone="info"
        title="Home"
        description={
          <>
            {greeting()}, {me.user.name.split(" ")[0]}. {longDate()}.{" "}
            <span className="whitespace-nowrap">
              {lastLogin
                ? `Last signed in ${dateTime(lastLogin)}.`
                : "Welcome to your first visit."}
            </span>
          </>
        }
      />

      <QuickActions />

      <section
        aria-label="Overview"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <StatTile
          index={0}
          icon={ZapIcon}
          accent="sky"
          label="In progress"
          value={mine.focus.length}
          meta="yours"
        />
        <StatTile
          index={1}
          icon={CalendarClockIcon}
          accent="amber"
          label="Due this week"
          value={mine.dueThisWeek}
          meta="yours"
        />
        <StatTile
          index={2}
          icon={TriangleAlertIcon}
          accent="rose"
          label="Overdue"
          value={mine.overdue}
          meta="yours"
          metaClassName={mine.overdue ? HEALTH.overdue.className : undefined}
        />
        <StatTile
          index={3}
          icon={BellDotIcon}
          accent="violet"
          label="New for you"
          value={unseen.total}
          meta="since you looked"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <Reveal
          index={4}
          className="rounded-sheet bg-card p-3 shadow-sm sm:p-4"
        >
          <div className="flex items-baseline justify-between px-3 pt-2 pb-3">
            <h2 className="text-lg">New for you</h2>
            <Link
              href="/projects"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              All projects
            </Link>
          </div>
          <UnseenList
            total={unseen.total}
            tasks={unseen.rows.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              projectId: t.projectId,
              projectName: t.projectName,
              projectColor: t.projectColor,
              changed: `changed ${ago(new Date(t.changedAt), now)}`,
              opened: t.viewedAt
                ? `opened ${ago(t.viewedAt, now)}`
                : "never opened",
            }))}
          />
        </Reveal>

        <Reveal
          index={5}
          className="flex flex-col gap-3 rounded-sheet bg-card p-6 shadow-sm"
        >
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg">Activity</h2>
            <Link
              href="/activity"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              View more
            </Link>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing yet. Work on tasks and it shows here.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {activity.map((a) => (
                <ActivityRow key={a.id} a={a} now={now} />
              ))}
            </ol>
          )}
        </Reveal>
      </div>
    </Reveal>
  )
}
