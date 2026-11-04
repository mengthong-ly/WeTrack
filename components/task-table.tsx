"use client"

import { FlagIcon, ListTreeIcon, MoreHorizontalIcon, PenLineIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"

import { deleteTask, updateTask } from "@/app/actions"
import { UserAvatar } from "@/components/bits"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/coss/table"
import { SortHead } from "@/components/data-table"
import { Pick } from "@/components/pick"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { BrowserTask } from "@/components/task-browser"
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
type Patch = { status?: TaskStatus; priority?: TaskPriority }

// One page of tasks, in the server's order (a sorted column, or overdue first then by deadline). The whole row opens the task; status and
// priority change in place (optimistic, the server reconciles). Narrow screens scroll the table, never the page.
export function TaskTable({ tasks, sort }: { tasks: BrowserTask[]; sort: Sort<TaskSort> }) {
  const [, start] = useTransition()
  const [patches, patch] = useOptimistic({} as Record<string, Patch>, (s, [id, p]: [string, Patch]) => ({ ...s, [id]: { ...s[id], ...p } }))
  const shown = tasks.map((t) => (patches[t.id] ? { ...t, ...patches[t.id] } : t))

  function save(t: BrowserTask, p: Patch) {
    start(async () => {
      patch([t.id, p])
      const res = await updateTask(t.id, p)
      if (res.error) toast.error(res.error)
      else if (p.status === "completed") toast.success(`Completed “${t.title}”`)
    })
  }

  function remove(t: BrowserTask) {
    const also = t.subtasks.total ? ` and its ${t.subtasks.total} sub-tasks` : ""
    if (!confirm(`Delete “${t.title}”${also}? This can't be undone.`)) return
    start(async () => {
      const res = await deleteTask(t.id)
      if (res.error) toast.error(res.error)
      else toast.success("Task deleted")
    })
  }

  return (
    <Table className="min-w-3xl table-fixed">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <SortHead column="title" label="Task" sort={sort} className="ps-5" />
          <SortHead column="status" label="Status" sort={sort} className="w-40" />
          <SortHead column="priority" label="Priority" sort={sort} className="w-32" />
          <SortHead column="assignee" label="Assignee" sort={sort} className="w-44" />
          <SortHead column="deadline" label="Deadline" sort={sort} className="w-28" />
          <TableHead className="w-14 pe-3">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shown.map((t) => (
          <Row key={t.id} task={t} onSave={(p) => save(t, p)} onDelete={() => remove(t)} />
        ))}
      </TableBody>
    </Table>
  )
}

function Row({ task: t, onSave, onDelete }: { task: BrowserTask; onSave: (p: Patch) => void; onDelete: () => void }) {
  const done = t.status === "completed"
  const late = !done && (t.health === "overdue" || t.health === "due_soon")
  return (
    <TableRow className="group">
      <TableCell className="h-12 ps-5">
        <span className="flex min-w-0 items-center gap-2">
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
          {t.subtasks.total > 0 && (
            <span className="tabular flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <ListTreeIcon className="size-3.5" />
              {t.subtasks.done}/{t.subtasks.total}
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
          onChange={(v) => v !== t.status && onSave({ status: v as TaskStatus })}
          options={STATUS_OPTIONS}
        />
      </TableCell>
      <TableCell className="relative z-10 px-1">
        <Pick
          aria-label={`Priority of “${t.title}”`}
          variant="ghost"
          className={inline}
          value={t.priority}
          onChange={(v) => v !== t.priority && onSave({ priority: v as TaskPriority })}
          options={PRIORITY_OPTIONS}
        />
      </TableCell>
      <TableCell>
        {t.assignee ? (
          <span className="flex min-w-0 items-center gap-2">
            <UserAvatar user={t.assignee} className="size-6 ring-0" />
            <span className="truncate">{t.assignee.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Unassigned</span>
        )}
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
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2Icon />
              Delete task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}
