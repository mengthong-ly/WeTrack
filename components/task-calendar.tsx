"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useState } from "react"

import { ProjectDot } from "@/components/bits"
import type { BrowserTask } from "@/components/task-browser"
import { TaskList } from "@/components/task-card"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { HEALTH } from "@/lib/labels"
import { addMonths, monthGrid } from "@/lib/task-views"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const CHIPS = 3
const iconButton =
  "grid size-10 place-items-center rounded-full text-muted-foreground outline-none transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
const longDay = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
const count = (n: number) => `${n} ${n === 1 ? "task" : "tasks"}`

// Month grid with tasks on their deadline day. A day opens a side sheet with everything due then.
export function TaskCalendar({ tasks, today }: { tasks: BrowserTask[]; today: string }) {
  const [month, setMonth] = useState(today.slice(0, 7))
  // -1 / 1 slides the new month in from the side it came from; 0 (first render) doesn't animate.
  const [dir, setDir] = useState(0)
  const reduce = useReducedMotion()
  const go = (next: string) => {
    if (next === month) return
    setDir(next > month ? 1 : -1)
    setMonth(next)
  }
  // `day` outlives `open` so the sheet keeps its content while it slides out.
  const [day, setDay] = useState(today)
  const [open, setOpen] = useState(false)

  const due = new Map<string, BrowserTask[]>()
  for (const t of tasks) if (t.deadline) due.set(t.deadline, [...(due.get(t.deadline) ?? []), t])
  const undated = tasks.filter((t) => !t.deadline)
  const dayTasks = due.get(day) ?? []

  return (
    <div className="flex flex-col gap-6 rounded-sheet bg-card p-3 shadow-sm sm:p-4">
      <section>
        <div className="flex items-center gap-1 pt-1 pb-3 pl-3">
          <h2 className="mr-auto text-lg">
            {new Date(`${month}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </h2>
          <button
            type="button"
            onClick={() => go(today.slice(0, 7))}
            className="h-10 rounded-full px-4 text-sm text-muted-foreground outline-none transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
          >
            Today
          </button>
          <button type="button" aria-label="Previous month" onClick={() => go(addMonths(month, -1))} className={iconButton}>
            <ChevronLeftIcon className="size-4" />
          </button>
          <button type="button" aria-label="Next month" onClick={() => go(addMonths(month, 1))} className={iconButton}>
            <ChevronRightIcon className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 pb-1 sm:gap-1.5">
          {WEEKDAYS.map((w) => (
            <span key={w} aria-hidden className="text-center text-xs text-muted-foreground">
              <span className="sm:hidden">{w[0]}</span>
              <span className="hidden sm:inline">{w}</span>
            </span>
          ))}
        </div>
        <motion.div
          key={month}
          className="grid grid-cols-7 gap-1 sm:gap-1.5"
          initial={dir === 0 ? false : { opacity: 0, transform: `translateX(${reduce ? 0 : dir * 16}px)` }}
          animate={{ opacity: 1, transform: "translateX(0px)" }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {monthGrid(month).map((d) => {
            const list = due.get(d) ?? []
            const inMonth = d.startsWith(month)
            const past = d < today
            const more = list.length - CHIPS
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDay(d)
                  setOpen(true)
                }}
                aria-label={`${longDay(d)}, ${list.length ? count(list.length) : "nothing due"}`}
                className={cn(
                  "flex min-h-16 min-w-0 flex-col items-start gap-1 rounded-row p-1.5 text-left outline-none transition-[background-color,scale] duration-150 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-97 sm:min-h-24 sm:p-2",
                  inMonth ? "bg-muted/50" : "bg-muted/20",
                  d === today && "bg-muted ring-1 ring-foreground/10"
                )}
              >
                <span
                  className={cn(
                    "tabular grid size-6 shrink-0 place-items-center rounded-full text-xs",
                    d === today ? "bg-foreground text-background" : (past || !inMonth) && "text-muted-foreground"
                  )}
                >
                  {Number(d.slice(8))}
                </span>
                {/* Phones: a dot per task. Wider: title chips. */}
                {list.length > 0 && (
                  <span className="flex flex-wrap items-center gap-1 px-1 sm:hidden">
                    {list.slice(0, CHIPS).map((t) => (
                      <ProjectDot key={t.id} color={t.project.color} className="size-1.5" />
                    ))}
                    {more > 0 && <span className="text-[10px] leading-none text-muted-foreground">+{more}</span>}
                  </span>
                )}
                {list.slice(0, CHIPS).map((t) => (
                  <span
                    key={t.id}
                    className={cn(
                      "hidden w-full items-center gap-1.5 rounded-full bg-card px-2 py-0.5 text-xs shadow-sm sm:flex",
                      t.status === "completed"
                        ? "text-muted-foreground line-through decoration-foreground/30"
                        : t.health === "overdue" && HEALTH.overdue.className
                    )}
                  >
                    <ProjectDot color={t.project.color} className="size-1.5" />
                    <span className="truncate">{t.title}</span>
                  </span>
                ))}
                {more > 0 && <span className="hidden px-2 text-xs text-muted-foreground sm:block">+{more} more</span>}
              </button>
            )
          })}
        </motion.div>
      </section>

      {undated.length > 0 && (
        <section>
          <h2 className="flex items-baseline justify-between px-3 pt-2 pb-3 text-lg">
            No deadline
            <span className="tabular text-sm text-muted-foreground">{undated.length}</span>
          </h2>
          <TaskList tasks={undated} />
        </section>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="gap-0 bg-card p-0 data-[side=right]:w-full data-[side=right]:border-l-0 sm:rounded-l-tile data-[side=right]:sm:max-w-md">
          <SheetHeader className="px-6 pt-6 pb-4">
            <SheetTitle className="pr-8 text-2xl font-light tracking-tight">{longDay(day)}</SheetTitle>
            <SheetDescription>{dayTasks.length ? `${count(dayTasks.length)} due` : "Nothing due"}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-3 pb-6 sm:px-4">
            <TaskList
              tasks={dayTasks}
              empty={
                <p className="rounded-card bg-muted/60 px-5 py-6 text-sm text-muted-foreground">
                  Nothing due this day. Press C to add a task.
                </p>
              }
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
