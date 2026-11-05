"use client"

import { ChevronRightIcon, FlagIcon, ListTreeIcon, MoreHorizontalIcon, PenLineIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useOptimistic, useState, useTransition } from "react"
import { toast } from "sonner"

import { deleteTask, loadSubtasks, updateTask } from "@/app/actions"
import { AssigneePicker } from "@/components/assignee-picker"
import { Spinner } from "@/components/coss/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/coss/table"
import { SortHead } from "@/components/data-table"
import { Pick } from "@/components/pick"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { BrowserTask } from "@/components/task-browser"
import type { MemberLite } from "@/lib/options"
import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from "@/lib/db/enums"
import { formatDate, HEALTH, PRIORITY, STATUS } from "@/lib/labels"
import type { Sort } from "@/lib/paging"
import { taskHref } from "@/lib/routes"
import type { TaskSort } from "@/lib/task-views"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS = TASK_STATUSES.map((s) => ({
  value: s,
  label: (
    <span className={cn("flex min-w-0 items-center gap-2", STATUS[s].className)}>
      <span className="size-2 shrink-0 rounded-full bg-current" />
      <span className="truncate">{STATUS[s].label}</span>
    </span>
  ),
}))
const PRIORITY_OPTIONS = TASK_PRIORITIES.map((p) => ({
  value: p,
  label: (
    <span className={cn("flex items-center gap-1.5", PRIORITY[p].className)}>
      <FlagIcon className="size-3.5 fill-current" />
      {PRIORITY[p].label}
    </span>
  ),
}))
// Inline selects: flush with the cell until hovered, so the row reads as text.
const inline = "ml-0 h-8 w-full justify-between rounded-lg px-2.5 hover:bg-muted dark:bg-transparent dark:hover:bg-muted"
type Patch = { status?: TaskStatus; priority?: TaskPriority; assigneeIds?: string[] }

// The tree column: sub-tasks sit one step in from their parent, joined to it by a line that runs down the parent's
// chevron and bends into each child (the docs-sidebar tree). `guides[i]` says whether the ancestor at level i + 1 has
// more children below, so its line carries on through this row.
const INDENT = 24
const BASE = 20
const trunk = (level: number) => BASE + (level - 1) * INDENT + INDENT / 2

// One page of tasks, in the server's order (a sorted column, or overdue first then by deadline). The whole row opens the task; status,
// priority and assignees change in place (optimistic, the server reconciles). A task with sub-tasks has an arrow that opens
// them underneath, any depth. Narrow screens scroll the table, never the page.
export function TaskTable({ tasks, members, sort }: { tasks: BrowserTask[]; members: MemberLite[]; sort: Sort<TaskSort> }) {
  return (
    <Table className="min-w-3xl table-fixed">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <SortHead column="title" label="Task" sort={sort} className="ps-5" />
          <SortHead column="status" label="Status" sort={sort} className="w-40" />
          <SortHead column="priority" label="Priority" sort={sort} className="w-32" />
          <SortHead column="assignee" label="Assignee" sort={sort} className="w-48" />
          <SortHead column="deadline" label="Deadline" sort={sort} className="w-28" />
          <TableHead className="w-14 pe-3">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((t) => (
          <Row key={t.id} task={t} members={members} />
        ))}
      </TableBody>
    </Table>
  )
}

function Row({
  task,
  members,
  depth = 0,
  guides = [],
  last = false,
  onPatched,
  onRemoved,
}: {
  task: BrowserTask
  members: MemberLite[]
  depth?: number
  guides?: boolean[]
  last?: boolean
  onPatched?: (id: string, patch: Partial<BrowserTask>) => void
  onRemoved?: (id: string) => void
}) {
  const [, start] = useTransition()
  // `base` is what the server last told us (or we saved); `patches` sit on top while a save is in flight.
  const [base, setBase] = useState(task)
  const [seen, setSeen] = useState(task)
  if (task !== seen) {
    setSeen(task)
    setBase(task)
  }
  const [patches, patch] = useOptimistic({} as Patch, (s, p: Patch) => ({ ...s, ...p }))
  const [open, setOpen] = useState(false)
  const [kids, setKids] = useState<BrowserTask[] | null>(null)
  const [loading, setLoading] = useState(false)

  const asTask = (p: Patch): Partial<BrowserTask> => ({
    ...(p.status && { status: p.status }),
    ...(p.priority && { priority: p.priority }),
    ...(p.assigneeIds && {
      assignees: p.assigneeIds.map((id) => members.find((m) => m.id === id)).filter((m) => !!m),
      assigneeId: p.assigneeIds[0] ?? null,
    }),
  })
  const t = { ...base, ...asTask(patches) }
  const subtasks = kids ? { done: kids.filter((k) => k.status === "completed").length, total: kids.length } : t.subtasks
  const done = t.status === "completed"
  const late = !done && (t.health === "overdue" || t.health === "due_soon")

  function save(p: Patch) {
    start(async () => {
      patch(p)
      const res = await updateTask(t.id, p)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setBase((b) => ({ ...b, ...asTask(p) }))
      onPatched?.(t.id, asTask(p))
      if (p.status === "completed") toast.success(`Completed “${t.title}”`)
    })
  }

  function remove() {
    const also = subtasks.total ? ` and its ${subtasks.total} sub-tasks` : ""
    if (!confirm(`Delete “${t.title}”${also}? This can't be undone.`)) return
    start(async () => {
      const res = await deleteTask(t.id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Task deleted")
      onRemoved?.(t.id)
    })
  }

  async function toggle() {
    const next = !open
    setOpen(next)
    if (!next || kids) return
    setLoading(true)
    try {
      setKids(await loadSubtasks(t.id))
    } catch {
      toast.error("Couldn't load the sub-tasks.")
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <TableRow className={cn("group", depth > 0 && "animate-in fade-in-0 duration-200 motion-reduce:animate-none")}>
        <TableCell className="h-12" style={{ paddingLeft: BASE + depth * INDENT }}>
          {guides.map((more, i) => more && <span key={i} aria-hidden className="absolute inset-y-0 w-px bg-border" style={{ left: trunk(i + 1) }} />)}
          {depth > 0 && (
            <>
              <span aria-hidden className="absolute top-0 h-1/2 w-3 rounded-bl-lg border-b border-l border-border" style={{ left: trunk(depth) }} />
              {!last && <span aria-hidden className="absolute top-1/2 bottom-0 w-px bg-border" style={{ left: trunk(depth) }} />}
            </>
          )}
          <span className="flex min-w-0 items-center gap-2">
            {subtasks.total > 0 ? (
              <button
                type="button"
                aria-expanded={open}
                aria-label={`${open ? "Hide" : "Show"} sub-tasks of “${t.title}”`}
                onClick={toggle}
                className="relative z-10 -ms-1 grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
              >
                {loading ? <Spinner className="size-3.5" /> : <ChevronRightIcon className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-90")} />}
              </button>
            ) : (
              <span aria-hidden className="-ms-1 size-6 shrink-0" />
            )}
            {/* The title's link covers the row; the selects sit above it (z-10). */}
            <Link
              href={taskHref(t.projectId, t.id)}
              className={cn(
                "truncate outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset",
                done && "text-muted-foreground line-through decoration-foreground/30"
              )}
            >
              {t.title}
            </Link>
            {subtasks.total > 0 && (
              <span className="tabular flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <ListTreeIcon className="size-3.5" />
                {subtasks.done}/{subtasks.total}
              </span>
            )}
          </span>
        </TableCell>
        <TableCell className="relative z-10 px-1">
          <Pick
            aria-label={`Status of “${t.title}”`}
            variant="ghost"
            className={inline}
            value={t.status}
            onChange={(v) => v !== t.status && save({ status: v as TaskStatus })}
            options={STATUS_OPTIONS}
          />
        </TableCell>
        <TableCell className="relative z-10 px-1">
          <Pick
            aria-label={`Priority of “${t.title}”`}
            variant="ghost"
            className={inline}
            value={t.priority}
            onChange={(v) => v !== t.priority && save({ priority: v as TaskPriority })}
            options={PRIORITY_OPTIONS}
          />
        </TableCell>
        <TableCell className="relative z-10 px-1">
          <AssigneePicker
            aria-label={`Assignees of “${t.title}”`}
            members={members}
            value={t.assignees.map((a) => a.id)}
            onChange={(assigneeIds) => save({ assigneeIds })}
          />
        </TableCell>
        <TableCell className={cn("tabular", late ? HEALTH[t.health].className : "text-muted-foreground")}>
          {formatDate(t.deadline) ?? "—"}
        </TableCell>
        <TableCell className="relative z-10 pe-3 text-right">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for “${t.title}”`}
              className="grid size-8 place-items-center rounded-lg text-muted-foreground outline-none transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
            >
              <MoreHorizontalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href={taskHref(t.projectId, t.id)} />}>
                <PenLineIcon />
                Open task
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={remove}>
                <Trash2Icon />
                Delete task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
      {open &&
        kids?.map((k, i) => (
          <Row
            key={k.id}
            task={k}
            members={members}
            depth={depth + 1}
            guides={depth > 0 ? [...guides, !last] : guides}
            last={i === kids.length - 1}
            onPatched={(id, p) => setKids((list) => list && list.map((x) => (x.id === id ? { ...x, ...p } : x)))}
            onRemoved={(id) => setKids((list) => list && list.filter((x) => x.id !== id))}
          />
        ))}
    </>
  )
}
