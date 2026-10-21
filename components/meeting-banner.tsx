"use client"

import { VideoIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import { bannerState, joinUrl } from "@/lib/meetings"

export type BannerMeeting = {
  id: string
  title: string
  startsAt: string
  endsAt: string
  meetUrl: string | null
  calendarUrl: string | null
  canceledAt: string | null
}

// A 30-second clock. Null on the server, so the banner never renders a stale minute count.
const TICK = 30_000
let now = Date.now()
function subscribe(onChange: () => void) {
  const update = () => {
    now = Date.now()
    onChange()
  }
  update()
  const id = setInterval(update, TICK)
  document.addEventListener("visibilitychange", update)
  return () => {
    clearInterval(id)
    document.removeEventListener("visibilitychange", update)
  }
}
const useNow = () => useSyncExternalStore(subscribe, () => now, () => null)

/** "Design review starts in 45 min · Join", from an hour before until the meeting ends. */
export function MeetingBanner({ meetings }: { meetings: BannerMeeting[] }) {
  const t = useNow()
  const reduce = useReducedMotion()
  const due =
    t === null
      ? []
      : meetings
          .map((m) => {
            const meeting = {
              ...m,
              startsAt: new Date(m.startsAt),
              endsAt: new Date(m.endsAt),
              canceledAt: m.canceledAt ? new Date(m.canceledAt) : null,
            }
            return { meeting, state: bannerState(meeting, new Date(t)) }
          })
          .filter((d) => d.state !== null)
          .sort((a, b) => a.meeting.startsAt.getTime() - b.meeting.startsAt.getTime())
  const first = due[0]
  const url = first && joinUrl(first.meeting)

  return (
    <AnimatePresence>
      {first && (
        <motion.section
          key="meeting-banner"
          aria-label="Meeting soon"
          initial={{ opacity: 0, y: reduce ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: reduce ? 1 : 0.97, transition: { duration: 0.2 } }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 flex items-center gap-3 rounded-tile bg-card/70 p-2 pl-2.5 ring-1 ring-foreground/5 backdrop-blur"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted" aria-hidden>
            <VideoIcon className="size-4.5" />
          </span>
          <p className="flex min-w-0 flex-1 flex-col text-sm sm:flex-row sm:items-baseline sm:gap-1.5">
            <span className="truncate">{first.meeting.title}</span>
            <span className="shrink-0 text-muted-foreground">
              {first.state!.kind === "live" ? (
                "is on now"
              ) : (
                <>
                  starts in <span className="tabular">{first.state!.minutes} min</span>
                </>
              )}
              {due.length > 1 && <span className="tabular"> · +{due.length - 1} more</span>}
            </span>
          </p>
          {url && (
            <Button
              nativeButton={false}
              render={<a href={url} target="_blank" rel="noreferrer" />}
              className="h-10 rounded-full px-5 transition-[background-color,scale] active:scale-95"
            >
              Join
            </Button>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  )
}
