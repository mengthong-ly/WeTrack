"use client"

import {
  ArrowUpIcon,
  CalendarIcon,
  CircleDashedIcon,
  FlagIcon,
  FolderIcon,
  type LucideIcon,
  SparklesIcon,
  TagIcon,
  UserIcon,
  XIcon,
} from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import type { DateRange } from "react-day-picker"
import { toast } from "sonner"

import { createTask } from "@/app/actions"
import { ProjectDot } from "@/components/bits"
import { DateRangePicker } from "@/components/date-range-picker"
import { Pick } from "@/components/pick"
import { RichText } from "@/components/rich-text"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { TaskPriority, TaskStatus, TaskType } from "@/lib/db/enums"
import { PRIORITY } from "@/lib/labels"
import {
  type MemberLite,
  priorityOptions,
  type ProjectLite,
  statusOptions,
  typeOptions,
  UNASSIGNED,
} from "@/lib/options"
import { type Captured, parseCapture } from "@/lib/quick-capture"

const LAST_PROJECT = "wetrack:last-project"
const NO_PRESET = {}
const propPick = "ml-0 min-w-0 flex-1 justify-between px-2.5 hover:bg-card dark:bg-transparent dark:hover:bg-card"
const kbd = "grid h-5 min-w-5 place-items-center rounded-md bg-muted px-1 font-sans text-[11px] text-foreground"

function Token({ children }: { children: React.ReactNode }) {
  return <code className="rounded-md bg-muted px-1.5 py-0.5 font-sans text-foreground/80">{children}</code>
}

// One labelled property row in the create dialog's properties panel.
function Prop({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-11 items-center gap-2 pl-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="w-16 shrink-0 text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export function NewTaskDialog({
  open,
  onOpenChange,
  projects,
  members,
  meId,
  preset = NO_PRESET,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preset?: { priority?: TaskPriority }
  projects: ProjectLite[]
  members: MemberLite[]
  meId: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string>()
  // Remember the last project used; only read on the client (the dialog content never server-renders).
  const [projectId, setProjectId] = useState(() => {
    try {
      const last = typeof window === "undefined" ? null : localStorage.getItem(LAST_PROJECT)
      if (last && projects.some((p) => p.id === last)) return last
    } catch {}
    return projects[0]?.id ?? ""
  })
  const [priority, setPriority] = useState<TaskPriority>(preset.priority ?? "normal")
  // Each open passes a new preset; apply it during render rather than in an effect.
  const [appliedPreset, setAppliedPreset] = useState(preset)
  if (preset !== appliedPreset) {
    setAppliedPreset(preset)
    setPriority(preset.priority ?? "normal")
  }
  const [type, setType] = useState<TaskType>("development")
  const [status, setStatus] = useState<TaskStatus>("not_started")
  const [assigneeId, setAssigneeId] = useState(meId)
  const [title, setTitle] = useState("")
  const [range, setRange] = useState<DateRange>()
  const [captured, setCaptured] = useState<Captured>({ title: "" })

  // Quick capture: "#project @person due fri !urgent" in the title fills the fields as you type.
  // Only fields whose token changed are applied, so picking a value by hand afterwards sticks.
  function onTitle(text: string) {
    setTitle(text)
    const next = parseCapture(text, { projects, members, meId, today: format(new Date(), "yyyy-MM-dd") })
    if (next.projectId && next.projectId !== captured.projectId) setProjectId(next.projectId)
    if (next.assigneeId && next.assigneeId !== captured.assigneeId) setAssigneeId(next.assigneeId)
    if (next.priority && next.priority !== captured.priority) setPriority(next.priority)
    if (next.deadline && next.deadline !== captured.deadline) setRange({ from: new Date(`${next.deadline}T00:00:00`) })
    setCaptured(next)
  }
  const picked = [
    captured.projectId && projects.find((p) => p.id === captured.projectId)?.name,
    captured.assigneeId && members.find((m) => m.id === captured.assigneeId)?.name.split(" ")[0],
    captured.deadline && `Due ${format(new Date(`${captured.deadline}T00:00:00`), "EEE d MMM")}`,
    captured.priority && PRIORITY[captured.priority].label,
  ].filter(Boolean) as string[]

  function submit(form: FormData) {
    start(async () => {
      const res = await createTask({
        title: captured.title || title,
        description: String(form.get("description") ?? ""),
        projectId,
        assigneeId: assigneeId === UNASSIGNED ? null : assigneeId,
        type,
        priority,
        status,
        progress: 0,
        startDate: String(form.get("startDate") || "") || null,
        deadline: String(form.get("deadline") || "") || null,
      })
      if (res.error) return setError(res.error)
      try {
        localStorage.setItem(LAST_PROJECT, projectId)
      } catch {}
      setError(undefined)
      setTitle("")
      setCaptured({ title: "" })
      setRange(undefined)
      onOpenChange(false)
      toast.success("Task added", {
        action: { label: "Open", onClick: () => router.push(`/tasks/${res.id}`) },
      })
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 rounded-tile p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">New task</DialogTitle>
        {projects.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-lg">Create a project first</p>
            <p className="mt-1 text-sm text-muted-foreground">Tasks live inside a project or client.</p>
            <Button className="mt-5 rounded-full" nativeButton={false} render={<Link href="/projects" />} onClick={() => onOpenChange(false)}>
              Go to projects
            </Button>
          </div>
        ) : (
          <form
            action={submit}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") e.currentTarget.requestSubmit()
            }}
          >
            <div className="flex items-center justify-between px-6 pt-5">
              <span className="text-xs text-muted-foreground">New task</span>
              <DialogClose
                aria-label="Close"
                className="-mr-2 grid size-8 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <XIcon className="size-4" />
              </DialogClose>
            </div>
            <div className="flex flex-col gap-1 px-6 pt-2 pb-4">
              <Input
                name="title"
                required
                autoFocus
                value={title}
                onChange={(e) => onTitle(e.target.value)}
                placeholder="What needs doing?"
                aria-label="Task title"
                aria-describedby="capture-hint"
                className="h-auto border-0 bg-transparent px-0 text-3xl font-light tracking-tight shadow-none focus-visible:ring-0 md:text-3xl dark:bg-transparent"
              />
              <p id="capture-hint" className="flex min-h-6 flex-wrap items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
                {picked.length ? (
                  <>
                    <SparklesIcon className="size-3.5" />
                    Picked up
                    {picked.map((p) => (
                      <span key={p} className="rounded-full bg-muted px-2 py-0.5 text-foreground">{p}</span>
                    ))}
                  </>
                ) : (
                  <>Type <Token>#project</Token> <Token>@person</Token> <Token>due fri</Token> <Token>!urgent</Token> to fill the fields</>
                )}
              </p>
              <RichText
                name="description"
                placeholder="Add a description…"
                aria-label="Description"
                className="flex-col-reverse"
                contentClassName="min-h-14 max-h-60 overflow-y-auto text-sm text-muted-foreground"
              />
            </div>
            <div className="mx-3 grid rounded-panel bg-muted/60 p-1.5 sm:grid-cols-2">
              <Prop icon={FolderIcon} label="Project">
                <Pick
                  aria-label="Project"
                  variant="ghost"
                  className={propPick}
                  value={projectId}
                  onChange={setProjectId}
                  options={projects.map((p) => ({
                    value: p.id,
                    label: (
                      <span className="flex items-center gap-2">
                        <ProjectDot color={p.color} />
                        {p.name}
                      </span>
                    ),
                  }))}
                />
              </Prop>
              <Prop icon={UserIcon} label="Assignee">
                <Pick
                  aria-label="Assignee"
                  variant="ghost"
                  className={propPick}
                  value={assigneeId}
                  onChange={setAssigneeId}
                  options={[
                    { value: UNASSIGNED, label: "Unassigned" },
                    ...members.map((m) => ({ value: m.id, label: m.id === meId ? `${m.name} (me)` : m.name })),
                  ]}
                />
              </Prop>
              <Prop icon={CircleDashedIcon} label="Status">
                <Pick aria-label="Status" variant="ghost" className={propPick} value={status} onChange={(v) => setStatus(v as TaskStatus)} options={statusOptions} />
              </Prop>
              <Prop icon={FlagIcon} label="Priority">
                <Pick aria-label="Priority" variant="ghost" className={propPick} value={priority} onChange={(v) => setPriority(v as TaskPriority)} options={priorityOptions} />
              </Prop>
              <Prop icon={TagIcon} label="Type">
                <Pick aria-label="Type" variant="ghost" className={propPick} value={type} onChange={(v) => setType(v as TaskType)} options={typeOptions} />
              </Prop>
              <Prop icon={CalendarIcon} label="Dates">
                <DateRangePicker className="flex-1" range={range} onRangeChange={setRange} />
              </Prop>
            </div>
            {error && <p className="px-6 pt-3 text-sm text-destructive" role="alert">{error}</p>}
            <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-5">
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                <kbd className={kbd}>⌘</kbd>
                <kbd className={kbd}>↵</kbd>
                to add
                <span className="mx-1 text-foreground/20">·</span>
                <kbd className={kbd}>C</kbd>
                anywhere for a new one
              </span>
              <Button type="submit" size="lg" className="ml-auto h-10 gap-2 rounded-full px-5" disabled={pending}>
                {pending ? "Adding…" : "Add task"}
                {!pending && <ArrowUpIcon className="size-4" />}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
