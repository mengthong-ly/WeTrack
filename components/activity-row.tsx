import Link from "next/link"

import { describeActivity } from "@/lib/activity-text"
import { ACCENT, type Accent } from "@/lib/labels"
import type { recentActivity } from "@/lib/queries"
import { taskHref } from "@/lib/routes"
import { ago } from "@/lib/time"

type Row = Awaited<ReturnType<typeof recentActivity>>[number]

// The dot beside a line: green for finished, sky for moves, amber for dates, violet for meetings and updates.
const DOT: Record<string, Accent> = {
  task_completed: "emerald",
  task_created: "sky",
  status_changed: "sky",
  deadline_changed: "amber",
  meeting_scheduled: "violet",
  client_update_sent: "violet",
}

// One line of the activity log: who, what, which task (a link when it still exists) and how long ago.
export function ActivityRow({ a, now }: { a: Row; now: Date }) {
  return (
    <li className="relative flex flex-col pl-4 text-sm">
      <span
        aria-hidden
        className={`absolute top-1.5 left-0 size-2 rounded-full ${ACCENT[DOT[a.kind] ?? "sky"].dot}`}
      />
      <span>
        <span className="font-medium">{a.actor ?? "Someone"}</span>{" "}
        {describeActivity(a.kind, a.data)}{" "}
        {a.taskId && a.projectId ? (
          <Link
            href={taskHref(a.projectId, a.taskId)}
            className="underline-offset-4 hover:underline"
          >
            {a.taskTitle}
          </Link>
        ) : (
          a.taskTitle
        )}
      </span>
      <span className="text-xs text-muted-foreground">
        {ago(a.createdAt, now)}
      </span>
    </li>
  )
}
