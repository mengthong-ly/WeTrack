"use client"

import { CheckCheckIcon, CheckIcon } from "lucide-react"
import Link from "next/link"
import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"

import { markTasksSeen } from "@/app/actions"
import { ProjectDot, StatusText } from "@/components/bits"
import { Button } from "@/components/coss/button"
import type { TaskStatus } from "@/lib/db/enums"
import { taskHref } from "@/lib/routes"

export type UnseenTask = {
  id: string
  title: string
  status: TaskStatus
  projectId: string
  projectName: string
  projectColor: string
  /** Preformatted on the server: "changed 2h ago". */
  changed: string
  /** "opened 1 day ago" or "never opened". */
  opened: string
}

// Tasks that changed since you last opened them. Opening one marks it seen; "Mark seen" does it without opening.
export function UnseenList({ tasks, total }: { tasks: UnseenTask[]; total: number }) {
  const [, start] = useTransition()
  const [gone, hide] = useOptimistic(new Set<string>(), (s, ids: string[]) => new Set([...s, ...ids]))
  const shown = tasks.filter((t) => !gone.has(t.id))
  const left = total - (tasks.length - shown.length)

  function seen(ids: string[]) {
    start(async () => {
      hide(ids)
      try {
        await markTasksSeen(ids)
      } catch {
        toast.error("Couldn't mark that as seen.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-1">
      {shown.length > 1 && (
        <Button variant="ghost" size="sm" className="mb-1 self-end" onClick={() => seen(shown.map((t) => t.id))}>
          <CheckCheckIcon />
          Mark all seen
        </Button>
      )}
      {shown.length === 0 ? (
        <p className="rounded-card bg-muted/60 px-5 py-6 text-sm text-muted-foreground">You’re all caught up. Changes to your tasks show up here.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {shown.map((t) => (
            <li key={t.id} className="group relative flex min-h-14 items-center gap-3 rounded-row bg-muted/60 px-3 transition-colors hover:bg-muted">
              <ProjectDot color={t.projectColor} />
              <span className="flex min-w-0 flex-col">
                <Link
                  href={taskHref(t.projectId, t.id)}
                  className="truncate text-sm outline-none after:absolute after:inset-0 after:rounded-row focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
                >
                  {t.title}
                </Link>
                <span className="truncate text-xs text-muted-foreground">
                  {t.projectName} · {t.changed} · {t.opened}
                </span>
              </span>
              <StatusText status={t.status} className="ml-auto hidden shrink-0 text-xs sm:block" />
              <Button
                variant="ghost"
                size="icon-sm"
                className="relative z-10 shrink-0"
                aria-label={`Mark “${t.title}” seen`}
                onClick={() => seen([t.id])}
              >
                <CheckIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {left > shown.length && <p className="px-1 pt-2 text-xs text-muted-foreground">and {left - shown.length} more</p>}
    </div>
  )
}
