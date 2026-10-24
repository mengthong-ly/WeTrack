"use client"

import { AnimatePresence, motion } from "motion/react"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { sendClientUpdate } from "@/app/actions"
import { LoadMore } from "@/components/bits"
import { spring } from "@/components/motion-bits"
import { CopyButton } from "@/components/share-link-card"
import { Button } from "@/components/ui/button"
import { BUCKETS, draftMessage, type UpdateItem } from "@/lib/client-update"
import { formatDate } from "@/lib/labels"
import { useFeed } from "@/lib/use-server-list"
import { cn } from "@/lib/utils"

export function ClientUpdateComposer({
  projectId,
  projectName,
  items,
  today,
}: {
  projectId: string
  projectName: string
  items: UpdateItem[]
  today: string
}) {
  const [selected, setSelected] = useState(
    () => new Set(items.map((i) => i.taskId))
  )
  const [edited, setEdited] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const chosen = useMemo(
    () => items.filter((i) => selected.has(i.taskId)),
    [items, selected]
  )
  const draft = useMemo(
    () => draftMessage(projectName, chosen, today),
    [projectName, chosen, today]
  )
  const message = edited ?? draft

  const toggle = (taskId: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })

  const send = () =>
    start(async () => {
      const res = await sendClientUpdate({
        projectId,
        activityIds: chosen.flatMap((i) => i.ids),
        message,
        itemCount: chosen.length,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      setEdited(null)
      toast.success(
        `Marked ${chosen.length} item${chosen.length === 1 ? "" : "s"} as sent to ${projectName}`
      )
    })

  if (items.length === 0) {
    return (
      <p className="rounded-card bg-muted/60 px-5 py-8 text-center text-muted-foreground">
        Nothing new to report. Completed tasks, status changes and moved
        deadlines show up here.
      </p>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        {BUCKETS.map(({ key, heading }) => {
          const group = items.filter((i) => i.bucket === key)
          if (!group.length) return null
          return (
            <section key={key}>
              <h3 className="px-1 pb-2 text-sm text-muted-foreground">
                {heading}
              </h3>
              <ul className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {group.map((i) => {
                    const on = selected.has(i.taskId)
                    return (
                      <motion.li
                        key={i.taskId}
                        layout
                        exit={{ opacity: 0, height: 0 }}
                        transition={spring}
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          aria-label={i.title}
                          onClick={() => toggle(i.taskId)}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-row bg-muted/70 px-4 py-3.5 text-left transition-colors hover:bg-muted",
                            !on && "opacity-60"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors",
                              on
                                ? "border-foreground bg-foreground text-background"
                                : "border-foreground/30"
                            )}
                          >
                            {on && (
                              <svg
                                viewBox="0 0 24 24"
                                className="size-3"
                                fill="none"
                              >
                                <path
                                  d="M5 12.5l4.5 4.5L19 7.5"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-base">{i.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {i.deadlineMoved !== undefined &&
                              i.bucket !== "completed"
                                ? `Deadline ${i.deadlineMoved ? `moved to ${formatDate(i.deadlineMoved)}` : "removed"} · `
                                : ""}
                              {i.ids.length} change
                              {i.ids.length === 1 ? "" : "s"} since{" "}
                              {new Date(i.since).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          </span>
                        </button>
                      </motion.li>
                    )
                  })}
                </AnimatePresence>
              </ul>
            </section>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-baseline justify-between px-1">
          <h3 className="text-sm text-muted-foreground">Message</h3>
          {edited !== null && (
            <button
              type="button"
              onClick={() => setEdited(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Reset to draft
            </button>
          )}
        </div>
        <textarea
          aria-label="Message to the client"
          value={message}
          onChange={(e) => setEdited(e.target.value)}
          className="field-sizing-content min-h-64 w-full resize-none rounded-panel bg-muted/70 p-5 text-sm leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={message} label="Copy message" />
          <Button
            type="button"
            className="h-10 rounded-full px-5"
            disabled={pending || chosen.length === 0}
            onClick={send}
          >
            {pending ? "Saving…" : `Mark ${chosen.length} as sent`}
          </Button>
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          Copy the message into Telegram or email, then mark it as sent so these
          items leave the list.
        </p>
      </div>
    </div>
  )
}

export type SentUpdate = { id: string; when: string; itemCount: number; sentBy: string | null; message: string }

// Updates already sent to the client, newest first; older ones load on demand.
export function UpdateHistory({ projectId, latest, total }: { projectId: string; latest: SentUpdate[]; total: number }) {
  const { rows, left, more, pending } = useFeed(latest, total, `/api/projects/${projectId}/updates`)
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {rows.map((h) => (
          <li key={h.id}>
            <details className="group rounded-row bg-muted/70 px-4 py-3.5">
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3">
                <span>{h.when}</span>
                <span className="text-sm text-muted-foreground">
                  {h.itemCount} item{h.itemCount === 1 ? "" : "s"} · {h.sentBy ?? "Former member"}
                </span>
              </summary>
              <p className="mt-3 text-sm whitespace-pre-wrap text-muted-foreground">{h.message}</p>
            </details>
          </li>
        ))}
        {rows.length === 0 && <li className="text-sm text-muted-foreground">Sent updates will be listed here.</li>}
      </ul>
      <LoadMore left={left} pending={pending} onClick={more} label="Show older" className="bg-muted/60 ring-0 backdrop-blur-none hover:bg-muted" />
    </div>
  )
}
