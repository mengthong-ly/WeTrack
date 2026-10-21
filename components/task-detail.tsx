"use client"

import {
  ArrowLeftIcon,
  CalendarIcon,
  CircleDashedIcon,
  FlagIcon,
  FolderIcon,
  GaugeIcon,
  MoreHorizontalIcon,
  RocketIcon,
  SendIcon,
  ShapesIcon,
  Trash2Icon,
  UsersIcon,
  VideoIcon,
  XIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useRouter } from "next/navigation"
import { useOptimistic, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import {
  addComment,
  addSubtask,
  deleteSubtask,
  deleteTask,
  toggleSubtask,
  updateTask,
} from "@/app/actions"
import { ProjectDot, UserAvatar } from "@/components/bits"
import { spring } from "@/components/motion-bits"
import { openNewMeeting } from "@/components/new-meeting-dialog"
import { Pick } from "@/components/pick"
import { RichText } from "@/components/rich-text"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { TaskPriority, TaskStatus, TaskType } from "@/lib/db/enums"
import { formatDate, HEALTH, PRIORITY, RELEASE_STAGE, STATUS } from "@/lib/labels"
import {
  type MemberLite,
  priorityOptions,
  type ProjectLite,
  statusOptions,
  typeOptions,
  UNASSIGNED,
} from "@/lib/options"
import type { Health, ReleaseStage } from "@/lib/schedule"
import { cn } from "@/lib/utils"

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
  subtasks: { id: string; title: string; done: boolean }[]
  comments: { id: string; body: string; createdAt: string; author: { name: string; image: string | null } | null }[]
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
  task,
  projects,
  members,
}: {
  task: TaskDetailData
  projects: ProjectLite[]
  members: MemberLite[]
}) {
  const router = useRouter()
  const save = useSave(task.id)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <RoundButton aria-label="Back" onClick={() => router.back()}>
          <ArrowLeftIcon className="size-5" />
        </RoundButton>
        <div className="flex items-center gap-2">
          <RoundButton aria-label="Schedule meeting" title="Schedule meeting" onClick={() => openNewMeeting({ title: task.title, taskId: task.id })}>
            <VideoIcon className="size-5" />
          </RoundButton>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="More actions"
              className="grid size-11 place-items-center rounded-full bg-card/70 ring-1 ring-foreground/5 backdrop-blur transition hover:bg-card"
            >
              <MoreHorizontalIcon className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onClick={async () => {
                  if (!confirm(`Delete “${task.title}”? This can't be undone.`)) return
                  const res = await deleteTask(task.id)
                  if (res.error) return toast.error(res.error)
                  toast.success("Task deleted")
                  router.push("/tasks")
                }}
              >
                <Trash2Icon />
                Delete task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <EditableTitle value={task.title} onSave={(title) => save({ title })} />

      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-8 gap-y-1.5 text-sm">
        <Row icon={CalendarIcon} label="Deadline">
          <div className="flex flex-wrap items-center gap-3">
            <DateInput aria-label="Deadline" value={task.deadline} onSave={(deadline) => save({ deadline })} />
            {task.health !== "no_deadline" && task.health !== "done" && (
              <span className={cn("text-xs", HEALTH[task.health].className)}>
                {HEALTH[task.health].label}
                {task.daysLeft !== null && task.daysLeft >= 0 && ` · ${task.daysLeft === 0 ? "today" : `${task.daysLeft}d left`}`}
              </span>
            )}
          </div>
        </Row>
        <Row icon={CalendarIcon} label="Start">
          <DateInput aria-label="Start date" value={task.startDate} onSave={(startDate) => save({ startDate })} />
        </Row>
        <Row icon={FolderIcon} label="Project">
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
        </Row>
        <Row icon={FlagIcon} label="Priority">
          <Pick
            variant="ghost"
            aria-label="Priority"
            className={PRIORITY[task.priority].className}
            value={task.priority}
            onChange={(v) => save({ priority: v as TaskPriority })}
            options={priorityOptions}
          />
        </Row>
        <Row icon={UsersIcon} label="Assigned">
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
        </Row>
        <Row icon={CircleDashedIcon} label="Status">
          <Pick
            variant="ghost"
            aria-label="Status"
            className={STATUS[task.status].className}
            value={task.status}
            onChange={(v) => save({ status: v as TaskStatus })}
            options={statusOptions}
          />
        </Row>
        <Row icon={GaugeIcon} label="Progress">
          <ProgressSlider
            value={task.status === "completed" ? 100 : task.progress}
            disabled={task.status === "completed"}
            onSave={(progress) => save({ progress })}
          />
        </Row>
        <Row icon={ShapesIcon} label="Type">
          <Pick
            variant="ghost"
            aria-label="Type"
            value={task.type}
            onChange={(v) => save({ type: v as TaskType })}
            options={typeOptions}
          />
        </Row>
        <Row icon={RocketIcon} label="Release">
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
        </Row>
      </dl>

      <Tabs defaultValue="subtasks" className="gap-4">
        <TabsList className="h-12 w-full rounded-full bg-card/70 p-1 ring-1 ring-foreground/5 sm:w-fit">
          {[
            ["subtasks", `Sub-tasks (${task.subtasks.length})`],
            ["details", "Details"],
            ["comments", `Comments${task.comments.length ? ` (${task.comments.length})` : ""}`],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="rounded-full px-5 font-normal data-active:bg-card data-active:shadow-sm"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="subtasks">
          <Subtasks taskId={task.id} subtasks={task.subtasks} />
        </TabsContent>
        <TabsContent value="details">
          <Details task={task} onSave={(description) => save({ description })} />
        </TabsContent>
        <TabsContent value="comments">
          <Comments taskId={task.id} comments={task.comments} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function RoundButton(props: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="grid size-11 place-items-center rounded-full bg-card/70 ring-1 ring-foreground/5 outline-none backdrop-blur transition-[background-color,scale,box-shadow] hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
    />
  )
}

function Row({ icon: Icon, label, children }: { icon: typeof CalendarIcon; label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="flex items-center gap-2.5 py-1.5 text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}

function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  return (
    <textarea
      aria-label="Task title"
      value={draft}
      rows={1}
      onChange={(e) => setDraft(e.target.value.replace(/\n/g, ""))}
      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
      onBlur={() => {
        const next = draft.trim()
        if (!next) return setDraft(value)
        if (next !== value) onSave(next)
      }}
      className="field-sizing-content w-full resize-none bg-transparent text-4xl leading-tight font-light tracking-tight outline-none sm:text-5xl"
    />
  )
}

function DateInput({
  value,
  onSave,
  ...props
}: { value: string | null; onSave: (v: string | null) => void } & Pick<React.ComponentProps<"input">, "aria-label">) {
  return (
    <input
      type="date"
      defaultValue={value ?? ""}
      onChange={(e) => onSave(e.target.value || null)}
      className="h-9 rounded-full bg-transparent px-2.5 -ml-2.5 text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      {...props}
    />
  )
}

function ProgressSlider({ value, disabled, onSave }: { value: number; disabled?: boolean; onSave: (v: number) => void }) {
  const [v, setV] = useState(value)
  return (
    <div className="flex max-w-72 items-center gap-3">
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
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-foreground/10 accent-foreground disabled:cursor-not-allowed"
      />
      <span className="w-10 text-right tabular">{disabled ? 100 : v}%</span>
    </div>
  )
}

function Subtasks({ taskId, subtasks }: { taskId: string; subtasks: TaskDetailData["subtasks"] }) {
  const [, start] = useTransition()
  const [items, apply] = useOptimistic(
    subtasks,
    (state, action: { type: "toggle"; id: string } | { type: "delete"; id: string } | { type: "add"; title: string }) => {
      if (action.type === "toggle") return state.map((s) => (s.id === action.id ? { ...s, done: !s.done } : s))
      if (action.type === "delete") return state.filter((s) => s.id !== action.id)
      return [...state, { id: `tmp-${state.length}`, title: action.title, done: false }]
    }
  )
  const input = useRef<HTMLInputElement>(null)
  // Titles added here. When the saved row (real id) replaces its optimistic "tmp-" row, it mounts in place
  // instead of fading in while the tmp row fades out, which read as a flicker.
  const [added, setAdded] = useState<string[]>([])
  const enter = (s: { id: string; title: string }) =>
    !s.id.startsWith("tmp-") && added.includes(s.title) ? false : { opacity: 0, y: 6 }

  const run = (fn: () => Promise<{ error?: string }>, optimistic: Parameters<typeof apply>[0]) =>
    start(async () => {
      apply(optimistic)
      const res = await fn()
      if (res.error) toast.error(res.error)
    })

  return (
    <div className="flex flex-col gap-2">
      <ul className="relative flex flex-col gap-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((s) => (
            <motion.li
              key={s.id}
              layout
              initial={enter(s)}
              animate={{ opacity: 1, y: 0 }}
              // A tmp row is swapped for the saved one, so it leaves at once; real rows fade and shrink.
              exit={s.id.startsWith("tmp-") ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
              transition={spring}
              className="group flex items-center gap-3 rounded-row bg-card px-4 py-3.5 shadow-sm"
            >
              <button
                type="button"
                aria-label={s.done ? "Mark sub-task not done" : "Mark sub-task done"}
                onClick={() => run(() => toggleSubtask(s.id, !s.done), { type: "toggle", id: s.id })}
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors",
                  s.done ? "border-foreground bg-foreground text-background" : "border-foreground/30 hover:border-foreground/60"
                )}
              >
                {s.done && (
                  <svg viewBox="0 0 24 24" className="size-3" fill="none">
                    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <span className={cn("flex-1 text-base", s.done && "text-muted-foreground line-through")}>{s.title}</span>
              <button
                type="button"
                aria-label={`Delete ${s.title}`}
                onClick={() => run(() => deleteSubtask(s.id), { type: "delete", id: s.id })}
                className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
              >
                <XIcon className="size-4" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <form
        action={(form) => {
          const title = String(form.get("title") ?? "").trim()
          if (!title) return
          input.current!.value = ""
          setAdded((a) => [...a, title])
          run(() => addSubtask(taskId, title), { type: "add", title })
        }}
      >
        <Input
          ref={input}
          name="title"
          placeholder="Add a sub-task and press Enter"
          aria-label="New sub-task"
          className="h-12 rounded-row border-dashed bg-transparent px-4 text-base"
        />
      </form>
    </div>
  )
}

function Details({ task, onSave }: { task: TaskDetailData; onSave: (v: string | null) => void }) {
  return (
    <div className="flex flex-col gap-4 rounded-panel bg-card p-5 shadow-sm">
      <RichText
        aria-label="Description"
        defaultValue={task.description}
        placeholder="Add a description, links, acceptance notes…"
        onBlur={(md) => md !== (task.description ?? "") && onSave(md || null)}
        contentClassName="min-h-40 text-base"
      />
      <p className="text-xs text-muted-foreground">Created {formatDate(task.createdAt.slice(0, 10), true)}</p>
    </div>
  )
}

function Comments({ taskId, comments }: { taskId: string; comments: TaskDetailData["comments"] }) {
  const [pending, start] = useTransition()
  const form = useRef<HTMLFormElement>(null)
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {comments.map((c) => (
          <motion.li key={c.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
            <UserAvatar user={c.author ?? { name: "?" }} className="size-8 ring-0" />
            <div className="min-w-0 flex-1 rounded-row rounded-tl-md bg-card px-4 py-3 shadow-sm">
              <p className="text-xs text-muted-foreground">
                <span className="text-foreground">{c.author?.name ?? "Former member"}</span> ·{" "}
                {new Date(c.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="mt-1 text-base whitespace-pre-wrap">{c.body}</p>
            </div>
          </motion.li>
        ))}
        {comments.length === 0 && <li className="px-1 text-sm text-muted-foreground">No comments yet.</li>}
      </ul>
      <form
        ref={form}
        action={(data) =>
          start(async () => {
            const res = await addComment(taskId, String(data.get("body") ?? ""))
            if (res.error) toast.error(res.error)
            else form.current?.reset()
          })
        }
        className="flex items-center gap-2 rounded-full bg-card p-1.5 pl-5 shadow-sm ring-1 ring-foreground/5"
      >
        <input name="body" required placeholder="Write a comment" aria-label="Comment" className="flex-1 bg-transparent text-sm outline-none" />
        <button
          type="submit"
          disabled={pending}
          aria-label="Send comment"
          className="grid size-10 place-items-center rounded-full bg-foreground text-background transition hover:opacity-90 disabled:opacity-50"
        >
          <SendIcon className="size-4" />
        </button>
      </form>
    </div>
  )
}
