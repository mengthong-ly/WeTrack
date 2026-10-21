"use client"

import { addMinutes, format, isToday, isTomorrow, startOfDay } from "date-fns"
import { ArrowUpIcon, CalendarIcon, ClockIcon, type LucideIcon, MailIcon, UsersIcon, XIcon } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import { createMeeting } from "@/app/actions"
import { UserAvatar } from "@/components/bits"
import { ConnectGoogle } from "@/components/connect-google"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { MemberLite } from "@/lib/options"
import { cn } from "@/lib/utils"

export const NEW_MEETING_EVENT = "wetrack:new-meeting"

type Prefill = { title?: string; taskId?: string }

export function openNewMeeting(prefill?: Prefill) {
  window.dispatchEvent(new CustomEvent(NEW_MEETING_EVENT, { detail: prefill }))
}

const kbd = "grid h-5 min-w-5 place-items-center rounded-md bg-muted px-1 font-sans text-[11px] text-foreground"
const ghost = "flex h-9 min-w-0 flex-1 items-center rounded-full px-2.5 text-sm outline-none hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50"
const field = "h-9 flex-1 rounded-full border-0 bg-transparent px-2.5 shadow-none hover:bg-card dark:bg-transparent dark:hover:bg-card"

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const toHHMM = (min: number) => {
  const m = Math.min(min, 23 * 60 + 59) // a meeting ends on the day it starts
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

// Next half hour in the browser's time, 30 minutes long.
function defaults() {
  const now = new Date()
  const at = addMinutes(now, 30 - (now.getMinutes() % 30))
  at.setSeconds(0, 0)
  const start = format(at, "HH:mm")
  return { date: startOfDay(at), start, end: toHHMM(toMin(start) + 30) }
}

// Same row as `Prop` in new-task-dialog.tsx.
function Prop({ icon: Icon, label, className, children }: { icon: LucideIcon; label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex h-11 items-center gap-2 pl-2.5", className)}>
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="w-16 shrink-0 text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors",
        on ? "border-foreground bg-foreground text-background" : "border-foreground/30"
      )}
    >
      {on && (
        <svg viewBox="0 0 24 24" className="size-3" fill="none">
          <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}

// Mounted once in the app layout; opens on NEW_MEETING_EVENT (⌘K, task detail, Home).
export function NewMeetingDialog({
  members,
  meId,
  calendarConnected,
  googleEnabled,
}: {
  members: MemberLite[]
  meId: string
  calendarConnected: boolean
  googleEnabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [prefill, setPrefill] = useState<Prefill>({})

  useEffect(() => {
    const onOpen = (e: Event) => {
      setPrefill((e as CustomEvent<Prefill | undefined>).detail ?? {})
      setOpen(true)
    }
    window.addEventListener(NEW_MEETING_EVENT, onOpen)
    return () => window.removeEventListener(NEW_MEETING_EVENT, onOpen)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="gap-0 rounded-tile p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">New meeting</DialogTitle>
        <div className="flex items-center justify-between px-6 pt-5">
          <span className="text-xs text-muted-foreground">New meeting</span>
          <DialogClose
            aria-label="Close"
            className="-mr-2 grid size-8 place-items-center rounded-full text-muted-foreground outline-none transition-[background-color,scale] hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
          >
            <XIcon className="size-4" />
          </DialogClose>
        </div>
        {/* The content unmounts on close, so every open starts from fresh defaults. */}
        {googleEnabled ? (
          <MeetingForm
            members={members}
            meId={meId}
            calendarConnected={calendarConnected}
            prefill={prefill}
            onDone={() => setOpen(false)}
          />
        ) : (
          <p className="px-6 pt-3 pb-7 text-sm text-muted-foreground">
            Meetings need Google Calendar, which isn&apos;t set up for this workspace yet.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MeetingForm({
  members,
  meId,
  calendarConnected,
  prefill,
  onDone,
}: {
  members: MemberLite[]
  meId: string
  calendarConnected: boolean
  prefill: Prefill
  onDone: () => void
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string>()
  const [connect, setConnect] = useState(!calendarConnected)
  const [initial] = useState(defaults)
  const [title, setTitle] = useState(prefill.title ?? "")
  const [date, setDate] = useState(initial.date)
  const [dateOpen, setDateOpen] = useState(false)
  const [startAt, setStartAt] = useState(initial.start)
  const [endAt, setEndAt] = useState(initial.end)
  const [people, setPeople] = useState<string[]>([meId])
  const [guests, setGuests] = useState("")

  // Moving the start keeps the meeting's length.
  function onStart(next: string) {
    if (next && startAt && endAt) setEndAt(toHHMM(toMin(next) + toMin(endAt) - toMin(startAt)))
    setStartAt(next)
  }

  const toggle = (id: string) => setPeople((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const picked = members.filter((m) => people.includes(m.id))
  const peopleLabel = picked
    .map((m) => (m.id === meId ? "Me" : m.name.split(" ")[0]))
    .sort((a, b) => Number(b === "Me") - Number(a === "Me"))
    .join(", ")

  function submit() {
    start(async () => {
      const res = await createMeeting({
        title,
        date: format(date, "yyyy-MM-dd"),
        start: startAt,
        end: endAt,
        memberIds: people,
        guests,
        taskId: prefill.taskId ?? null,
      })
      if (res.needsGoogle) return setConnect(true)
      if (res.error) return setError(res.error)
      onDone()
      const url = res.joinUrl
      toast.success("Meeting scheduled", url ? { action: { label: "Open", onClick: () => window.open(url, "_blank", "noopener") } } : undefined)
      if (res.warning) toast.warning(res.warning)
    })
  }

  if (connect) {
    return (
      <div className="flex flex-col items-start gap-4 px-6 pt-3 pb-6">
        <p className="text-sm text-muted-foreground">Connect Google Calendar to schedule meetings.</p>
        <ConnectGoogle className="h-10 rounded-full px-4" />
      </div>
    )
  }

  return (
    <form
      action={submit}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") e.currentTarget.requestSubmit()
      }}
    >
      <div className="px-6 pt-2 pb-4">
        <Input
          name="title"
          required
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's the meeting about?"
          aria-label="Meeting title"
          className="h-auto border-0 bg-transparent px-0 text-3xl font-light tracking-tight shadow-none focus-visible:ring-0 md:text-3xl dark:bg-transparent"
        />
      </div>
      <div className="mx-3 grid rounded-panel bg-muted/60 p-1.5 sm:grid-cols-2">
        <Prop icon={CalendarIcon} label="Date">
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger aria-label="Date" className={ghost}>
              <span className="tabular truncate">
                {isToday(date) ? "Today" : isTomorrow(date) ? "Tomorrow" : format(date, "EEE d MMM")}
              </span>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto rounded-tile p-3">
              <Calendar
                mode="single"
                required
                autoFocus
                selected={date}
                onSelect={(d) => {
                  setDate(d)
                  setDateOpen(false)
                }}
                defaultMonth={date}
                disabled={{ before: startOfDay(new Date()) }}
                className="p-1 [--cell-size:--spacing(9)] sm:[--cell-size:--spacing(10)]"
              />
            </PopoverContent>
          </Popover>
        </Prop>
        <Prop icon={UsersIcon} label="People">
          <Popover>
            <PopoverTrigger aria-label="People" className={ghost}>
              <span className={cn("truncate", !picked.length && "text-muted-foreground")}>{peopleLabel || "Add people"}</span>
            </PopoverTrigger>
            <PopoverContent align="start" className="max-h-80 w-64 gap-0 overflow-y-auto rounded-panel p-1.5">
              {members.map((m) => {
                const on = people.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(m.id)}
                    className="flex h-10 shrink-0 items-center gap-2.5 rounded-row px-2.5 text-left text-sm outline-none transition-[background-color,scale] hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-97"
                  >
                    <UserAvatar user={m} className="size-6 ring-0" />
                    <span className="min-w-0 flex-1 truncate">{m.id === meId ? `${m.name} (me)` : m.name}</span>
                    <Check on={on} />
                  </button>
                )
              })}
            </PopoverContent>
          </Popover>
        </Prop>
        <Prop icon={ClockIcon} label="Start">
          <Input type="time" step={300} required aria-label="Start time" value={startAt} onChange={(e) => onStart(e.target.value)} className={cn(field, "tabular")} />
        </Prop>
        <Prop icon={ClockIcon} label="End">
          <Input type="time" step={300} required aria-label="End time" value={endAt} onChange={(e) => setEndAt(e.target.value)} className={cn(field, "tabular")} />
        </Prop>
        <Prop icon={MailIcon} label="Guests" className="sm:col-span-2">
          <Input
            type="text"
            inputMode="email"
            aria-label="Guest emails"
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
            placeholder="ceo@company.com, …"
            className={field}
          />
        </Prop>
      </div>
      {error && <p className="px-6 pt-3 text-sm text-destructive" role="alert">{error}</p>}
      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-5">
        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <kbd className={kbd}>⌘</kbd>
          <kbd className={kbd}>↵</kbd>
          to schedule
        </span>
        <Button type="submit" size="lg" className="ml-auto h-10 gap-2 rounded-full px-5" disabled={pending}>
          {pending ? "Scheduling…" : "Schedule meeting"}
          {!pending && <ArrowUpIcon className="size-4" />}
        </Button>
      </div>
    </form>
  )
}
