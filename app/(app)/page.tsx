import Link from "next/link"

import { MeetingList, NewMeetingButton } from "@/components/meeting-list"
import { PageTransition, Reveal } from "@/components/motion-bits"
import { TaskList } from "@/components/task-card"
import { summarize } from "@/lib/dashboard"
import { HEALTH, STATUS } from "@/lib/labels"
import { listMembers, listTasks, meetingItems, upcomingMeetings } from "@/lib/queries"
import { todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"
import { toCard } from "@/lib/task-view"
import { cn } from "@/lib/utils"
import { greeting, longDate } from "@/lib/time"

// Home is a daily summary of *your* work: what you're on, then what's next. Everything else lives on its own page.
export default async function HomePage() {
  const me = await requireMember()
  const today = todayISO()
  const [tasks, meetings, members] = await Promise.all([
    listTasks(me.orgId),
    upcomingMeetings(me.orgId, { email: me.user.email, userId: me.user.id }),
    listMembers(me.orgId),
  ])
  const mine = tasks.filter((t) => t.assigneeId === me.user.id)

  const s = summarize(mine, today)
  const next = [...s.focus, ...s.upNext].slice(0, 7)

  const facts = [
    { n: s.focus.length, label: "in progress" },
    { n: s.dueThisWeek, label: "due this week" },
    { n: s.overdue, label: "overdue", className: HEALTH.overdue.className },
    { n: s.blocked, label: "blocked", className: STATUS.blocked.className },
  ].filter((f, i) => i < 2 || f.n > 0)

  return (
    <PageTransition>
      <div className="flex flex-col gap-6">
        <Reveal>
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
            {greeting()}, {me.user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {longDate()}
            {facts.map((f) => (
              <span key={f.label}>
                <span aria-hidden> · </span>
                <span className={cn("tabular text-foreground", f.n > 0 && f.className)}>{f.n}</span> {f.label}
              </span>
            ))}
          </p>
        </Reveal>

        <Reveal index={1} className="rounded-sheet bg-card p-3 shadow-sm sm:p-4">
          <div className="flex items-baseline justify-between px-3 pt-2 pb-3">
            <h2 className="text-lg">Continue</h2>
            <Link href="/tasks" className="text-sm text-muted-foreground hover:text-foreground">All tasks</Link>
          </div>
          <TaskList
            tasks={next.map((t) => toCard(t, today))}
            empty={<p className="rounded-card bg-muted/60 px-5 py-6 text-sm text-muted-foreground">Nothing on your plate. Press C to add a task.</p>}
          />
        </Reveal>

        {/* Your meetings this week, so ones without a task can be sent to Slack or cancelled too. */}
        {meetings.length > 0 && (
          <Reveal index={2} className="rounded-sheet bg-card p-3 shadow-sm sm:p-4">
            <div className="flex items-baseline justify-between px-3 pt-2 pb-3">
              <h2 className="text-lg">Meetings</h2>
              <NewMeetingButton />
            </div>
            <MeetingList meetings={meetingItems(meetings, members, { userId: me.user.id, email: me.user.email, role: me.role })} />
          </Reveal>
        )}
      </div>
    </PageTransition>
  )
}
