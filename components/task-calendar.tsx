"use client"

import { format } from "date-fns"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useAnimate, useReducedMotion } from "motion/react"
import { createContext, use, useState } from "react"

import { ProjectDot } from "@/components/bits"
import type { BrowserTask } from "@/components/task-browser"
import { TaskList } from "@/components/task-card"
import { Button } from "@/components/ui/button"
import { Calendar, CalendarDayButton } from "@/components/ui/calendar"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { HEALTH } from "@/lib/labels"
import { addMonths } from "@/lib/task-views"
import { cn } from "@/lib/utils"

const CHIPS = 3
const iso = (d: Date) => format(d, "yyyy-MM-dd")
const longDay = (day: string) => format(new Date(`${day}T00:00:00`), "EEEE d MMMM")
const count = (n: number) => `${n} ${n === 1 ? "task" : "tasks"}`
// Day cells read tasks from context so DayButton stays one stable component; an inline component would
// remount every cell on each render and drop keyboard focus when paging months.
const Due = createContext<{ due: Map<string, BrowserTask[]>; today: string }>({ due: new Map(), today: "" })
const COMPONENTS = { DayButton: DayCell }

// The shadcn Calendar (react-day-picker) laid out as a full-width month: tasks sit on their deadline day,
// and a day opens a side sheet with everything due then.
// `month` ("YYYY-MM") is the Tasks page's (?month=), which loads that month's tasks.
export function TaskCalendar({
  tasks,
  today,
  month,
  onMonth,
}: {
  tasks: BrowserTask[]
  today: string
  month: string
  onMonth: (month: string) => void
}) {
  // `day` outlives `open` so the sheet keeps its content while it slides out.
  const [day, setDay] = useState(today)
  const [open, setOpen] = useState(false)
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const reduce = useReducedMotion()

  // Buttons slide the new month in from the side it came from. Keyboard paging (arrow keys past the edge)
  // changes month without motion and keeps the grid mounted, so focus stays on the day.
  function go(next: string) {
    if (next === month) return
    const from = `translateX(${reduce ? 0 : next > month ? 16 : -16}px)`
    onMonth(next)
    animate(scope.current, { opacity: [0, 1], transform: [from, "translateX(0px)"] }, { duration: 0.3, ease: [0.16, 1, 0.3, 1] })
  }

  const due = new Map<string, BrowserTask[]>()
  for (const t of tasks) if (t.deadline) due.set(t.deadline, [...(due.get(t.deadline) ?? []), t])
  const undated = tasks.filter((t) => !t.deadline)
  const dayTasks = due.get(day) ?? []

  return (
    <div className="flex flex-col gap-6 rounded-sheet bg-card p-3 shadow-sm sm:p-4">
      <section>
        <div className="flex items-center gap-1 pt-1 pb-3 pl-3">
          <h2 className="mr-auto text-lg">{format(new Date(`${month}-01T00:00:00`), "MMMM yyyy")}</h2>
          <Button variant="ghost" className="h-10 rounded-full px-4 font-normal text-muted-foreground" onClick={() => go(today.slice(0, 7))}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="size-10 rounded-full text-muted-foreground" aria-label="Previous month" onClick={() => go(addMonths(month, -1))}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="ghost" size="icon" className="size-10 rounded-full text-muted-foreground" aria-label="Next month" onClick={() => go(addMonths(month, 1))}>
            <ChevronRightIcon />
          </Button>
        </div>

        <div ref={scope}>
          <Due value={{ due, today }}>
          <Calendar
            month={new Date(`${month}-01T00:00:00`)}
            onMonthChange={(d) => onMonth(format(d, "yyyy-MM"))}
            today={new Date(`${today}T00:00:00`)}
            weekStartsOn={1}
            hideNavigation
            onDayClick={(d) => {
              setDay(iso(d))
              setOpen(true)
            }}
            formatters={{ formatWeekdayName: (d) => format(d, "EEE") }}
            className="w-full bg-transparent p-0"
            classNames={{
              root: "w-full",
              months: "relative flex flex-col",
              month: "flex w-full flex-col",
              month_caption: "sr-only",
              month_grid: "w-full table-fixed border-collapse",
              weekdays: "flex gap-1 sm:gap-1.5",
              weekday: "flex-1 pb-1 text-xs font-normal text-muted-foreground select-none",
              week: "mt-1 flex w-full gap-1 sm:mt-1.5 sm:gap-1.5",
              day: "group/day relative min-w-0 flex-1 p-0 select-none",
              today: "",
              outside: "",
            }}
            components={COMPONENTS}
          />
          </Due>
        </div>
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

// shadcn's CalendarDayButton (keeps react-day-picker's focus and keyboard handling), restyled as a tall
// cell: date circle, then title chips on wider screens or project dots on phones.
function DayCell({ className, ...props }: React.ComponentProps<typeof CalendarDayButton>) {
  const { due, today } = use(Due)
  const d = iso(props.day.date)
  const tasks = due.get(d) ?? []
  const { outside, today: isToday } = props.modifiers
  const more = tasks.length - CHIPS
  return (
    <CalendarDayButton
      {...props}
      aria-label={`${longDay(d)}, ${tasks.length ? count(tasks.length) : "nothing due"}`}
      className={cn(
        "aspect-auto h-auto min-h-16 items-start justify-start rounded-row p-1.5 text-left transition-[background-color,scale] duration-150 hover:bg-muted active:scale-97 sm:min-h-24 sm:p-2 dark:hover:bg-muted",
        outside ? "bg-muted/20" : "bg-muted/50",
        isToday && "bg-muted ring-1 ring-foreground/10",
        className
      )}
    >
      <div className="flex w-full min-w-0 flex-col items-start gap-1">
        <span
          className={cn(
            "tabular grid size-6 shrink-0 place-items-center rounded-full text-xs",
            isToday ? "bg-foreground text-background" : (outside || d < today) && "text-muted-foreground"
          )}
        >
          {props.day.date.getDate()}
        </span>
        {tasks.length > 0 && (
          <span className="flex flex-wrap items-center gap-1 px-1 sm:hidden">
            {tasks.slice(0, CHIPS).map((t) => (
              <ProjectDot key={t.id} color={t.project.color} className="size-1.5" />
            ))}
            {more > 0 && <span className="text-[10px] leading-none text-muted-foreground">+{more}</span>}
          </span>
        )}
        {tasks.slice(0, CHIPS).map((t) => (
          <span
            key={t.id}
            className={cn(
              "hidden w-full items-center gap-1.5 rounded-full bg-card px-2 py-0.5 text-xs leading-normal shadow-sm sm:flex",
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
      </div>
    </CalendarDayButton>
  )
}
