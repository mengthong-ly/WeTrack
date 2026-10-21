"use client"

import { MoreHorizontalIcon, XCircleIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"

import { cancelMeeting } from "@/app/actions"
import { UserAvatar } from "@/components/bits"
import { spring } from "@/components/motion-bits"
import { openNewMeeting } from "@/components/new-meeting-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { MeetingItem } from "@/lib/queries"

/** Upcoming meetings: time, title, task, people and Join. `readOnly` drops the menu and task links (CEO page). */
export function MeetingList({
  meetings,
  readOnly,
  empty,
}: {
  meetings: MeetingItem[]
  readOnly?: boolean
  empty?: React.ReactNode
}) {
  const [items, remove] = useOptimistic(meetings, (list, id: string) => list.filter((m) => m.id !== id))
  const [, start] = useTransition()

  const cancel = (m: MeetingItem) => {
    if (!confirm("Cancel this meeting?")) return
    start(async () => {
      remove(m.id)
      const res = await cancelMeeting(m.id)
      if (res.error) toast.error(res.error)
      else if (res.warning) toast.warning(res.warning)
      else toast.success("Meeting cancelled")
    })
  }

  return (
    <>
      <ul className="@container relative flex flex-col gap-2.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((m) => (
            <motion.li
              key={m.id}
              layout
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
              transition={spring}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 rounded-row bg-muted/60 py-3 pr-2 pl-4"
            >
              <p className="tabular col-span-2 pr-2 text-xs text-muted-foreground @md:col-span-1">{m.slot}</p>
              <p className="col-span-2 truncate pr-2 text-sm @md:col-span-1">{m.title}</p>
              {/* Narrow (Home column): actions share the last line. Wide (task page): they sit on the right. */}
              <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                {m.people.length > 0 && (
                  <span className="flex shrink-0 -space-x-1.5">
                    {m.people.slice(0, 4).map((p) => (
                      <UserAvatar key={p.id} user={p} className="size-5 ring-2 ring-muted" />
                    ))}
                    {m.people.length > 4 && <span className="tabular pl-2.5">+{m.people.length - 4}</span>}
                  </span>
                )}
                {m.task &&
                  (readOnly ? (
                    <span className="truncate">{m.task.title}</span>
                  ) : (
                    <Link href={`/tasks/${m.task.id}`} className="truncate hover:text-foreground hover:underline">
                      {m.task.title}
                    </Link>
                  ))}
              </div>
              <div className="flex items-center gap-2 @md:col-start-2 @md:row-span-3 @md:row-start-1">
                {m.joinUrl && (
                  <Button
                    variant="ghost"
                    nativeButton={false}
                    render={<a href={m.joinUrl} target="_blank" rel="noreferrer" />}
                    className="h-10 rounded-full bg-card px-4 font-normal shadow-sm transition-[background-color,scale] hover:bg-card/70 active:scale-95"
                  >
                    Join
                  </Button>
                )}
                {!readOnly && m.canCancel && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Actions for ${m.title}`}
                      className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground outline-none transition-[background-color,color,scale] hover:bg-card hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
                    >
                      <MoreHorizontalIcon className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem variant="destructive" onClick={() => cancel(m)}>
                        <XCircleIcon />
                        Cancel meeting
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {items.length === 0 && empty}
    </>
  )
}

export function NewMeetingButton() {
  return (
    <Button
      variant="ghost"
      onClick={() => openNewMeeting()}
      className="-mx-3 -my-2 h-10 rounded-full px-3 font-normal text-muted-foreground transition-[background-color,scale] active:scale-95"
    >
      New meeting
    </Button>
  )
}
