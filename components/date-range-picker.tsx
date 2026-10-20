"use client"

import { format, isSameDay } from "date-fns"
import { CalendarRangeIcon, XIcon } from "lucide-react"
import { useState, useSyncExternalStore } from "react"
import type { DateRange } from "react-day-picker"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const iso = (d: Date) => format(d, "yyyy-MM-dd")
const short = (d: Date) => format(d, "d MMM")

// Two months side by side from md up, one on phones.
const wide = "(min-width: 768px)"
function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(wide)
      m.addEventListener("change", cb)
      return () => m.removeEventListener("change", cb)
    },
    () => matchMedia(wide).matches,
    () => true
  )
}

// Start → deadline as one range. Picking a single day means "due that day" (no start).
// Posts `startDate` and `deadline` as yyyy-MM-dd through hidden inputs, so it drops into any <form>.
// Pass `range` + `onRangeChange` to control it from outside (quick capture fills it in).
export function DateRangePicker({
  className,
  range: controlled,
  onRangeChange,
}: {
  className?: string
  range?: DateRange
  onRangeChange?: (range: DateRange | undefined) => void
}) {
  const [own, setOwn] = useState<DateRange>()
  const range = onRangeChange ? controlled : own
  const setRange = onRangeChange ?? setOwn
  const twoMonths = useWide()
  const from = range?.from
  const to = range?.to
  const single = from && (!to || isSameDay(from, to))
  const startDate = from && !single ? iso(from) : ""
  const deadline = to ? iso(to) : from ? iso(from) : ""

  return (
    <Popover>
      <input type="hidden" name="startDate" value={startDate} />
      <input type="hidden" name="deadline" value={deadline} />
      <div className={cn("relative flex items-center", className)}>
        <PopoverTrigger
          aria-label="Dates"
          className="flex h-9 flex-1 items-center gap-2 rounded-full px-2.5 text-sm outline-none hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {!from ? (
            <span className="text-muted-foreground">Add dates</span>
          ) : single ? (
            <span className="tabular">Due {short(from)}</span>
          ) : (
            <span className="tabular">
              {short(from)} <span className="text-muted-foreground">→</span> {short(to!)}
            </span>
          )}
        </PopoverTrigger>
        {from && (
          <button
            type="button"
            aria-label="Clear dates"
            onClick={() => setRange(undefined)}
            className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
      <PopoverContent align="start" className="w-auto rounded-tile p-3">
        <Calendar
          mode="range"
          selected={range}
          onSelect={setRange}
          defaultMonth={from}
          numberOfMonths={twoMonths ? 2 : 1}
          className="p-1 [--cell-size:--spacing(9)] sm:[--cell-size:--spacing(10)]"
        />
        <p className="flex w-0 min-w-full items-start gap-1.5 px-1 pb-1 text-xs text-muted-foreground">
          <CalendarRangeIcon className="mt-px size-3.5 shrink-0" />
          Pick a start and a deadline, or one day for a due date.
        </p>
      </PopoverContent>
    </Popover>
  )
}
