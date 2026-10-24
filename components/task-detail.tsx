"use client"

import type { Editor } from "@tiptap/react"
import {
  ArrowUpIcon,
  CalendarIcon,
  CircleDashedIcon,
  FlagIcon,
  FolderIcon,
  GaugeIcon,
  ListTreeIcon,
  MessageSquareQuoteIcon,
  PlusIcon,
  RocketIcon,
  SendIcon,
  ShapesIcon,
  SparklesIcon,
  Trash2Icon,
  UsersIcon,
  VideoIcon,
  XIcon,
} from "lucide-react"
import { format } from "date-fns"
import { AnimatePresence, motion } from "motion/react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useOptimistic, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { addComment, addSubtask, createTask, deleteTask, updateTask } from "@/app/actions"
import { Crumbs, LoadMore, ProjectDot, StatusText, UserAvatar } from "@/components/bits"
import { FocusLayout, PanelToggle, SideAction, SideProp, SideSection, Tuned } from "@/components/editor-tools"
import { ImageGallery } from "@/components/image-gallery"
import { MeetingList } from "@/components/meeting-list"
import { spring } from "@/components/motion-bits"
import { openNewMeeting } from "@/components/new-meeting-dialog"
import { Pick } from "@/components/pick"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useCloseRoute } from "@/components/workspace-drawer"
import type { TaskPriority, TaskStatus, TaskType } from "@/lib/db/enums"
import { uploadTo } from "@/lib/image"
import { formatDate, HEALTH, PRIORITY, RELEASE_STAGE, STATUS } from "@/lib/labels"
import {
  type MemberLite,
  priorityOptions,
  type ProjectLite,
  statusOptions,
  typeOptions,
  UNASSIGNED,
} from "@/lib/options"
import type { MeetingItem } from "@/lib/queries"
import { type Captured, parseCapture } from "@/lib/quick-capture"
import type { Health, ReleaseStage } from "@/lib/schedule"
import { useFeed } from "@/lib/use-server-list"
import { cn } from "@/lib/utils"

// Tiptap loads after the page; until then read-only text shows as written.
const RichText = dynamic(() => import("@/components/rich-text").then((m) => m.RichText))

export type TaskDetailData = {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  type: TaskType
  progress: number
  startDate: string | null
  deadline: string | null
  projectId: string
  assigneeId: string | null
  health: Health
  daysLeft: number | null
  createdAt: string
  release: {
    version: string
    stage: ReleaseStage
    stagingPlanned: string | null
    stagingActual: string | null
    prodPlanned: string | null
    prodActual: string | null
  } | null
  /** Parents above this task, root first. */
  ancestors: { id: string; title: string }[]
  /** The whole family from the root down, in reading order, for the contents column. */
  family: { id: string; title: string; status: TaskStatus; depth: number }[]
  /** Direct children, oldest first. `subtasks` is how many they have under them. */
  subtasks: {
    id: string
    title: string
    status: TaskStatus
    priority: TaskPriority
    deadline: string | null
    assignee: { name: string; image: string | null } | null
    subtasks: number
  }[]
  /** The latest page, newest first. */
  comments: { id: string; body: string; createdAt: string; author: { name: string; image: string | null } | null }[]
  commentTotal: number
}

function useSave(taskId: string) {
  const [, start] = useTransition()
  return (patch: Parameters<typeof updateTask>[1]) =>
    start(async () => {
      const res = await updateTask(taskId, patch)
      if (res.error) toast.error(res.error)
    })
}

export function TaskDetail({
  task: saved,
  projects,
  members,
  meetings,
  inPanel = false,
  draft,
}: {
  task: TaskDetailData
  projects: ProjectLite[]
  members: MemberLite[]
  meetings: MeetingItem[]
  /** Shown in the workspace's side sheet: after a delete, go back to the workspace. */
  inPanel?: boolean
  /** The New task page: `task` is a blank preset, edits stay local until "Add task" creates it. */
  draft?: { meId: string }
}) {
  const router = useRouter()
  // In a workspace drawer, Back and Delete close the drawer (it slides out, then goes back).
  const back = useCloseRoute() ?? router.back
  const update = useSave(saved.id)
  const [local, setLocal] = useState(saved)
  const task = draft ? local : saved
  const save: typeof update = draft ? (patch) => setLocal((t) => ({ ...t, ...patch })) : update
  const [queued, setQueued] = useState<string[]>([])
  const [captured, setCaptured] = useState<Captured>({ title: "" })
  const [creating, startCreate] = useTransition()
  const body = useRef<Editor>(null)
  const project = projects.find((p) => p.id === task.projectId)
  const assignee = members.find((m) => m.id === task.assigneeId)
  const addRef = useRef<HTMLInputElement>(null)

  async function remove() {
    const also = task.subtasks.length ? " and everything under it" : ""
    if (!confirm(`Delete “${task.title}”${also}? This can't be undone.`)) return
    const res = await deleteTask(task.id)
    if (res.error) return toast.error(res.error)
    toast.success("Task deleted")
    const parent = task.ancestors.at(-1)
    if (inPanel) back()
    else router.push(parent ? `/tasks/${parent.id}` : "/tasks")
  }

  // Quick capture: "#project @person due fri !urgent" in the new title fills the fields as you type.
  // Only fields whose token changed are applied, so picking a value by hand afterwards sticks.
  function onDraftTitle(text: string) {
    const next = parseCapture(text, { projects, members, meId: draft!.meId, today: format(new Date(), "yyyy-MM-dd") })
    const patch: Partial<TaskDetailData> = { title: text }
    if (next.projectId && next.projectId !== captured.projectId) patch.projectId = next.projectId
    if (next.assigneeId && next.assigneeId !== captured.assigneeId) patch.assigneeId = next.assigneeId
    if (next.priority && next.priority !== captured.priority) patch.priority = next.priority
    if (next.deadline && next.deadline !== captured.deadline) patch.deadline = next.deadline
    setLocal((t) => ({ ...t, ...patch }))
    setCaptured(next)
  }

  function create() {
    const title = (captured.title || task.title).trim()
    if (!title) return toast.error("Give the task a title.")
    startCreate(async () => {
      const res = await createTask({
        title,
        description: body.current && !body.current.isEmpty ? body.current.getMarkdown() : "",
        projectId: task.projectId,
        assigneeId: task.assigneeId,
        type: task.type,
        priority: task.priority,
        status: task.status,
        progress: task.status === "completed" ? 100 : task.progress,
        startDate: task.startDate,
        deadline: task.deadline,
      })
      if (res.error || !res.id) {
        toast.error(res.error ?? "Couldn't add the task.")
        return
      }
      for (const t of queued) await addSubtask(res.id, t)
      toast.success("Task added")
      // The new task's page takes this one's place, so Back skips the empty form.
      router.replace(`/tasks/${res.id}`)
    })
  }

  if (draft && projects.length === 0)
    return (
      <div className="rounded-card bg-muted/60 px-5 py-6 text-sm text-muted-foreground">
        Tasks live inside a project or client. Create a project first.
        <Button className="mt-4 flex w-fit rounded-full" nativeButton={false} render={<Link href="/projects" />}>
          Go to projects
        </Button>
      </div>
    )

  const picked = [
    captured.projectId && projects.find((p) => p.id === captured.projectId)?.name,
    captured.assigneeId && members.find((m) => m.id === captured.assigneeId)?.name.split(" ")[0],
    captured.deadline && `Due ${formatDate(captured.deadline)}`,
    captured.priority && PRIORITY[captured.priority].label,
  ].filter(Boolean) as string[]

  return (
    // In the workspace sheet there's no app chrome to hide, and the page behind keeps its own.
    <div
      data-focus={inPanel ? undefined : ""}
      className="flex flex-col gap-6"
      onKeyDown={(e) => draft && (e.metaKey || e.ctrlKey) && e.key === "Enter" && (e.preventDefault(), create())}
    >
      <div className="flex items-center justify-between gap-2">
        <Crumbs
          onBack={back}
          trail={[{ href: "/tasks", label: "Tasks" }, ...task.ancestors.map((a) => ({ href: `/tasks/${a.id}`, label: a.title }))]}
          current={draft ? "New task" : task.title}
        />
        <div className="flex shrink-0 items-center gap-2">
          {draft && (
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <kbd className={kbd}>⌘</kbd>
              <kbd className={kbd}>↵</kbd>
              to add
            </span>
          )}
          <PanelToggle />
          {draft && (
            <Button
              type="button"
              onClick={create}
              className="h-11 gap-2 rounded-full px-5 transition-[background-color,scale] active:scale-95"
              disabled={creating}
            >
              {creating ? "Adding…" : "Add task"}
              {!creating && <ArrowUpIcon className="size-4" />}
            </Button>
          )}
        </div>
      </div>

      <ImageGallery>
      <FocusLayout
        contents={task.family.length > 1 && <Contents family={task.family} current={task.id} />}
        side={
          <>
            <SideSection label="Task">
              <TaskFields task={task} projects={projects} members={members} save={save} />
            </SideSection>
            <SideSection label="Actions">
              <SideAction icon={PlusIcon} onClick={() => addRef.current?.focus()}>Add sub-task</SideAction>
              {!draft && (
                <>
                  <SideAction icon={MessageSquareQuoteIcon} onClick={() => router.push(`/feedback/new?task=${task.id}`)}>Give feedback</SideAction>
                  <SideAction icon={VideoIcon} onClick={() => openNewMeeting({ title: task.title, taskId: task.id })}>Schedule meeting</SideAction>
                  <SideAction icon={Trash2Icon} onClick={remove} destructive>Delete task</SideAction>
                </>
              )}
            </SideSection>
            {meetings.length > 0 && (
              <section aria-label="Meetings" className="flex flex-col gap-2">
                <h2 className="px-2 pt-1 text-xs text-muted-foreground">Meetings</h2>
                <MeetingList meetings={meetings} />
              </section>
            )}
            {!draft && <p className="px-2 pt-1 text-xs text-muted-foreground">Created {formatDate(task.createdAt.slice(0, 10), true)}</p>}
          </>
        }
        tabs={draft ? [] : [
          {
            key: "comments",
            label: task.commentTotal ? `Comments ${task.commentTotal}` : "Comments",
            content: <Comments taskId={task.id} comments={task.comments} total={task.commentTotal} />,
          },
        ]}
      >
        {/* The task as one document: title, its facts in a quiet line, the description, then its sub-tasks. */}
        <article className="flex flex-col rounded-tile bg-card px-5 py-6 shadow-sm sm:px-10 sm:py-9">
          {draft ? (
            <EditableTitle value="" onSave={() => {}} onDraft={onDraftTitle} onEnter={() => body.current?.commands.focus("start")} />
          ) : (
            <EditableTitle value={task.title} onSave={(title) => save({ title })} />
          )}
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {project && (
              <span className="inline-flex items-center gap-1.5">
                <ProjectDot color={project.color} />
                {project.name}
              </span>
            )}
            <StatusText status={task.status} />
            {task.priority !== "normal" && <span className={PRIORITY[task.priority].className}>{PRIORITY[task.priority].label}</span>}
            {assignee && (
              <span className="inline-flex items-center gap-1.5">
                <UserAvatar user={assignee} className="size-5 ring-0" />
                {assignee.name}
              </span>
            )}
            {task.deadline && (
              <span className={cn("inline-flex items-center gap-1.5 tabular", task.health !== "done" && task.health !== "on_track" && HEALTH[task.health].className)}>
                <CalendarIcon className="size-3.5" />
                Due {formatDate(task.deadline)}
              </span>
            )}
          </p>
          {draft && (
            <p className="mt-2 flex min-h-6 flex-wrap items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
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
          )}
          <div className="mt-6 mb-6 h-px bg-foreground/5" />
          <Tuned>
            <RichText
              aria-label="Description"
              defaultValue={task.description}
              placeholder="Add details, or type / for headings, checklists and images…"
              onBlur={(md) => md !== (task.description ?? "") && save({ description: md || null })}
              onImage={uploadTo}
              onReady={(e) => (body.current = e)}
              contentClassName="min-h-40 text-base"
            />
          </Tuned>
          {draft ? (
            <Subtasks
              taskId=""
              subtasks={queued.map((title, i) => ({ id: `tmp-${i}`, title, status: "not_started", priority: "normal", deadline: null, assignee: null, subtasks: 0 }))}
              addRef={addRef}
              onAdd={(title) => setQueued((q) => [...q, title])}
            />
          ) : (
            <Subtasks taskId={task.id} subtasks={task.subtasks} addRef={addRef} />
          )}
        </article>
      </FocusLayout>
      </ImageGallery>
    </div>
  )
}

// The task's fields, edited in place in the side panel's Info tab.
function TaskFields({
  task,
  projects,
  members,
  save,
}: {
  task: TaskDetailData
  projects: ProjectLite[]
  members: MemberLite[]
  save: ReturnType<typeof useSave>
}) {
  return (
    <>
      <SideProp icon={CalendarIcon} label="Deadline">
        <div className="flex flex-wrap items-center gap-3">
          <DateInput aria-label="Deadline" value={task.deadline} onSave={(deadline) => save({ deadline })} />
          {task.health !== "no_deadline" && task.health !== "done" && (
            <span className={cn("text-xs", HEALTH[task.health].className)}>
              {HEALTH[task.health].label}
              {task.daysLeft !== null && task.daysLeft >= 0 && ` · ${task.daysLeft === 0 ? "today" : `${task.daysLeft}d left`}`}
            </span>
          )}
        </div>
      </SideProp>
      <SideProp icon={CalendarIcon} label="Start">
        <DateInput aria-label="Start date" value={task.startDate} onSave={(startDate) => save({ startDate })} />
      </SideProp>
      <SideProp icon={FolderIcon} label="Project">
        <Pick
          variant="ghost"
          aria-label="Project"
          value={task.projectId}
          onChange={(projectId) => save({ projectId })}
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
      </SideProp>
      <SideProp icon={FlagIcon} label="Priority">
        <Pick
          variant="ghost"
          aria-label="Priority"
          className={PRIORITY[task.priority].className}
          value={task.priority}
          onChange={(v) => save({ priority: v as TaskPriority })}
          options={priorityOptions}
        />
      </SideProp>
      <SideProp icon={UsersIcon} label="Assigned">
        <Pick
          variant="ghost"
          aria-label="Assignee"
          value={task.assigneeId ?? UNASSIGNED}
          onChange={(v) => save({ assigneeId: v === UNASSIGNED ? null : v })}
          options={[
            { value: UNASSIGNED, label: "Unassigned" },
            ...members.map((m) => ({
              value: m.id,
              label: (
                <span className="flex items-center gap-2">
                  <UserAvatar user={m} className="size-5 ring-0" />
                  {m.name}
                </span>
              ),
            })),
          ]}
        />
      </SideProp>
      <SideProp icon={CircleDashedIcon} label="Status">
        <Pick
          variant="ghost"
          aria-label="Status"
          className={STATUS[task.status].className}
          value={task.status}
          onChange={(v) => save({ status: v as TaskStatus })}
          options={statusOptions}
        />
      </SideProp>
      <SideProp icon={GaugeIcon} label="Progress">
        <ProgressSlider
          value={task.status === "completed" ? 100 : task.progress}
          disabled={task.status === "completed"}
          onSave={(progress) => save({ progress })}
        />
      </SideProp>
      <SideProp icon={ShapesIcon} label="Type">
        <Pick
          variant="ghost"
          aria-label="Type"
          value={task.type}
          onChange={(v) => save({ type: v as TaskType })}
          options={typeOptions}
        />
      </SideProp>
      <SideProp icon={RocketIcon} label="Release">
        {task.release ? (
          <span>
            {task.release.version} · {RELEASE_STAGE[task.release.stage]}
            <span className="block text-xs text-muted-foreground">
              Staging {formatDate(task.release.stagingActual ?? task.release.stagingPlanned) ?? "—"} · Production{" "}
              {formatDate(task.release.prodActual ?? task.release.prodPlanned) ?? "—"}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">Not in a release yet</span>
        )}
      </SideProp>
    </>
  )
}

// Left column on wide screens: the task's family as an outline, like a document's table of contents.
function Contents({ family, current }: { family: TaskDetailData["family"]; current: string }) {
  return (
    <nav aria-label="Contents" className="flex flex-col gap-0.5">
      <h2 className="px-3 pb-1 text-xs text-muted-foreground">Contents</h2>
      {family.map((f) => {
        const here = f.id === current
        return (
          <Link
            key={f.id}
            href={`/tasks/${f.id}`}
            aria-current={here ? "page" : undefined}
            style={{ paddingLeft: `${0.75 + f.depth * 1}rem` }}
            className={cn(
              "flex h-9 items-center gap-2.5 rounded-row pr-3 text-sm outline-none transition-[background-color,color,scale] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-97",
              here ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
            )}
          >
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full bg-current", STATUS[f.status].className, f.status === "not_started" && "bg-transparent ring-1 ring-current")} />
            <span className={cn("truncate", f.status === "completed" && "line-through decoration-foreground/30")}>{f.title}</span>
          </Link>
        )
      })}
    </nav>
  )
}

const kbd = "grid h-5 min-w-5 place-items-center rounded-md bg-muted px-1 font-sans text-[11px] text-foreground"

function Token({ children }: { children: React.ReactNode }) {
  return <code className="rounded-md bg-muted px-1.5 py-0.5 font-sans text-foreground/80">{children}</code>
}

// `onDraft` (a new task) reports every keystroke and Enter moves on to the description, as in a document.
function EditableTitle({
  value,
  onSave,
  onDraft,
  onEnter,
}: {
  value: string
  onSave: (v: string) => void
  onDraft?: (v: string) => void
  onEnter?: () => void
}) {
  const [draft, setDraft] = useState(value)
  return (
    <textarea
      aria-label="Task title"
      value={draft}
      rows={1}
      autoFocus={!!onDraft}
      placeholder={onDraft && "What needs doing?"}
      onChange={(e) => {
        const v = e.target.value.replace(/\n/g, "")
        setDraft(v)
        onDraft?.(v)
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" || e.metaKey || e.ctrlKey) return
        e.preventDefault()
        if (onEnter) onEnter()
        else e.currentTarget.blur()
      }}
      onBlur={() => {
        if (onDraft) return
        const next = draft.trim()
        if (!next) return setDraft(value)
        if (next !== value) onSave(next)
      }}
      className="field-sizing-content w-full resize-none overflow-hidden bg-transparent text-4xl leading-tight font-light tracking-tight outline-none placeholder:text-muted-foreground/60 sm:text-5xl"
    />
  )
}

// shadcn's date picker (Popover + single Calendar), as a ghost trigger like the panel's `Pick`s. Saves yyyy-MM-dd.
function DateInput({ value, onSave, "aria-label": label }: { value: string | null; onSave: (v: string | null) => void; "aria-label": string }) {
  const [date, setDate] = useState(value)
  const [open, setOpen] = useState(false)
  const day = date ? new Date(`${date}T00:00:00`) : undefined
  const set = (v: string | null) => {
    setDate(v)
    setOpen(false)
    if (v !== value) onSave(v)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex min-w-0 items-center">
        <PopoverTrigger
          aria-label={label}
          data-empty={!date}
          render={<Button variant="ghost" className="h-9 rounded-full px-2.5 font-normal tabular hover:bg-card data-[empty=true]:text-muted-foreground" />}
        >
          {formatDate(date, true) ?? "Pick a date"}
        </PopoverTrigger>
        {date && (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => set(null)}
            className="grid size-7 place-items-center rounded-full text-muted-foreground transition-[background-color,color,scale] hover:bg-card hover:text-foreground active:scale-90"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
      <PopoverContent align="start" className="w-auto rounded-tile p-3">
        <Calendar
          mode="single"
          selected={day}
          defaultMonth={day}
          onSelect={(d) => set(d ? format(d, "yyyy-MM-dd") : null)}
          className="p-1 [--cell-size:--spacing(9)] sm:[--cell-size:--spacing(10)]"
        />
      </PopoverContent>
    </Popover>
  )
}

function ProgressSlider({ value, disabled, onSave }: { value: number; disabled?: boolean; onSave: (v: number) => void }) {
  const [v, setV] = useState(value)
  return (
    <div className="flex w-full max-w-72 min-w-0 items-center gap-3">
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={disabled ? 100 : v}
        disabled={disabled}
        aria-label="Progress"
        onChange={(e) => setV(Number(e.target.value))}
        onPointerUp={() => v !== value && onSave(v)}
        onKeyUp={() => v !== value && onSave(v)}
        className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-foreground/10 accent-foreground disabled:cursor-not-allowed"
      />
      <span className="w-10 shrink-0 text-right tabular">{disabled ? 100 : v}%</span>
    </div>
  )
}

// Direct children as full tasks: tick to complete (optimistic), open for everything else. Adding one makes a
// real task under this one, in its project.
function Subtasks({
  taskId,
  subtasks,
  addRef,
  onAdd,
}: {
  taskId: string
  subtasks: TaskDetailData["subtasks"]
  addRef: React.RefObject<HTMLInputElement | null>
  /** A task not saved yet: keep the title to add once it exists. */
  onAdd?: (title: string) => void
}) {
  const [, start] = useTransition()
  const [items, apply] = useOptimistic(
    subtasks,
    (state, action: { type: "toggle"; id: string } | { type: "add"; title: string }) => {
      if (action.type === "toggle")
        return state.map((s) => (s.id === action.id ? { ...s, status: s.status === "completed" ? ("not_started" as const) : ("completed" as const) } : s))
      return [...state, { id: `tmp-${state.length}`, title: action.title, status: "not_started" as const, priority: "normal" as const, deadline: null, assignee: null, subtasks: 0 }]
    }
  )
  // Titles added here. When the saved row (real id) replaces its optimistic "tmp-" row, it mounts in place
  // instead of fading in while the tmp row fades out, which read as a flicker.
  const [added, setAdded] = useState<string[]>([])
  const enter = (s: { id: string; title: string }) =>
    !s.id.startsWith("tmp-") && added.includes(s.title) ? false : { opacity: 0, y: 6 }
  const done = items.filter((s) => s.status === "completed").length

  const run = (fn: () => Promise<{ error?: string }>, optimistic: Parameters<typeof apply>[0]) =>
    start(async () => {
      apply(optimistic)
      const res = await fn()
      if (res.error) toast.error(res.error)
    })

  return (
    <section aria-label="Sub-tasks" className="mt-8 flex flex-col gap-2">
      <h2 className="flex items-baseline justify-between text-lg">
        Sub-tasks
        {items.length > 0 && (
          <span className="tabular text-sm text-muted-foreground">
            {done}/{items.length} done
          </span>
        )}
      </h2>
      <ul className="relative flex flex-col gap-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((s) => {
            const isDone = s.status === "completed"
            const tmp = s.id.startsWith("tmp-")
            return (
              <motion.li
                key={s.id}
                layout
                initial={enter(s)}
                animate={{ opacity: 1, y: 0 }}
                // A tmp row is swapped for the saved one, so it leaves at once; real rows fade and shrink.
                exit={tmp ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
                transition={spring}
                className="relative flex items-center gap-3 rounded-row bg-muted/60 px-4 py-3 transition-colors hover:bg-muted"
              >
                <button
                  type="button"
                  disabled={tmp}
                  aria-label={isDone ? `Mark “${s.title}” not done` : `Mark “${s.title}” done`}
                  aria-pressed={isDone}
                  onClick={() => run(() => updateTask(s.id, { status: isDone ? "not_started" : "completed" }), { type: "toggle", id: s.id })}
                  className={cn(
                    "relative z-10 grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] outline-none transition-[background-color,border-color,scale] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-90",
                    isDone ? "border-foreground bg-foreground text-background" : "border-foreground/30 hover:border-foreground/60"
                  )}
                >
                  {isDone && (
                    <svg viewBox="0 0 24 24" className="size-3" fill="none">
                      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                {tmp ? (
                  <span className="min-w-0 flex-1 truncate text-base">{s.title}</span>
                ) : (
                  <Link
                    href={`/tasks/${s.id}`}
                    className={cn(
                      "min-w-0 flex-1 truncate text-base outline-none after:absolute after:inset-0 after:rounded-row focus-visible:underline",
                      isDone && "text-muted-foreground line-through decoration-foreground/30"
                    )}
                  >
                    {s.title}
                  </Link>
                )}
                <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  {s.subtasks > 0 && (
                    <span className="inline-flex items-center gap-1 tabular" title="Sub-tasks under it">
                      <ListTreeIcon className="size-3.5" />
                      {s.subtasks}
                    </span>
                  )}
                  {!isDone && s.status !== "not_started" && <StatusText status={s.status} className="text-xs max-sm:hidden" />}
                  {s.deadline && <span className="tabular max-sm:hidden">{formatDate(s.deadline)}</span>}
                  {s.assignee && <UserAvatar user={s.assignee} className="size-6 ring-0" />}
                </span>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
      <form
        action={(form) => {
          const title = String(form.get("title") ?? "").trim()
          if (!title) return
          addRef.current!.value = ""
          if (onAdd) return onAdd(title)
          setAdded((a) => [...a, title])
          run(() => addSubtask(taskId, title), { type: "add", title })
        }}
      >
        <label className="flex h-12 items-center gap-3 rounded-row border border-dashed border-foreground/15 px-4 text-muted-foreground transition-colors focus-within:border-foreground/30">
          <PlusIcon className="size-4 shrink-0" />
          <input
            ref={addRef}
            name="title"
            placeholder="Add a sub-task and press Enter"
            aria-label="New sub-task"
            className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
      </form>
    </section>
  )
}

// Oldest first, like a conversation: the latest page comes with the task, earlier ones load on demand.
function Comments({ taskId, comments, total }: { taskId: string; comments: TaskDetailData["comments"]; total: number }) {
  const feed = useFeed(comments, total, `/api/tasks/${taskId}/comments`)
  const [pending, start] = useTransition()
  const editor = useRef<Editor>(null)
  function send() {
    const body = editor.current?.isEmpty ? "" : (editor.current?.getMarkdown().trim() ?? "")
    if (!body || pending) return
    start(async () => {
      const res = await addComment(taskId, body)
      if (res.error) toast.error(res.error)
      else editor.current?.commands.clearContent()
    })
  }
  return (
    <div className="flex flex-col gap-3">
      <LoadMore
        left={feed.left}
        pending={feed.pending}
        onClick={feed.more}
        label="Show earlier comments"
        className="bg-card shadow-sm ring-0 backdrop-blur-none"
      />
      <ul className="flex flex-col gap-3">
        {feed.rows.toReversed().map((c) => (
          <motion.li key={c.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
            <UserAvatar user={c.author ?? { name: "?" }} className="size-8 ring-0" />
            <div className="min-w-0 flex-1 rounded-row rounded-tl-md bg-card px-4 py-3 shadow-sm">
              <p className="text-xs text-muted-foreground">
                <span className="text-foreground">{c.author?.name ?? "Former member"}</span> ·{" "}
                {new Date(c.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
              <RichText editable={false} defaultValue={c.body} className="mt-1" contentClassName="text-base" />
            </div>
          </motion.li>
        ))}
        {feed.rows.length === 0 && <li className="px-1 text-sm text-muted-foreground">No comments yet.</li>}
      </ul>
      <div className="flex items-end gap-2 rounded-panel bg-card p-1.5 pl-5 shadow-sm ring-1 ring-foreground/5">
        <RichText
          aria-label="Comment"
          placeholder="Write a comment"
          onImage={uploadTo}
          onSubmit={send}
          onReady={(e) => (editor.current = e)}
          className="min-w-0 flex-1 py-2"
          contentClassName="max-h-80 overflow-y-auto text-sm"
        />
        <button
          type="button"
          onClick={send}
          disabled={pending}
          aria-label="Send comment"
          title="Send (⌘↵)"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-foreground text-background transition-[opacity,scale] hover:opacity-90 active:scale-95 disabled:opacity-50"
        >
          <SendIcon className="size-4" />
        </button>
      </div>
    </div>
  )
}
