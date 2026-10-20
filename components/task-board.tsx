"use client"

import { CalendarIcon, FlagIcon, ListChecksIcon, MoreHorizontalIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { useOptimistic, useState, useTransition } from "react"
import { toast } from "sonner"

import { updateTask } from "@/app/actions"
import { ProjectDot, UserAvatar } from "@/components/bits"
import { spring } from "@/components/motion-bits"
import type { BrowserTask } from "@/components/task-browser"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TASK_STATUSES, type TaskStatus } from "@/lib/db/enums"
import { formatDate, HEALTH, PRIORITY, STATUS } from "@/lib/labels"
import { cn } from "@/lib/utils"

const DRAG_TYPE = "application/x-wetrack-task"

// Columns by status. Drag a card to another column (or use its "Move to" menu) to change status.
export function TaskBoard({ tasks }: { tasks: BrowserTask[] }) {
  const [, start] = useTransition()
  const [moved, move] = useOptimistic(
    {} as Record<string, TaskStatus>,
    (s, [id, status]: [string, TaskStatus]) => ({ ...s, [id]: status })
  )
  const [over, setOver] = useState<TaskStatus | null>(null)
  const statusOf = (t: BrowserTask) => moved[t.id] ?? t.status

  function setStatus(t: BrowserTask, status: TaskStatus) {
    if (statusOf(t) === status) return
    start(async () => {
      move([t.id, status])
      const res = await updateTask(t.id, { status })
      if (res.error) toast.error(res.error)
      else if (status === "completed") toast.success(`Completed “${t.title}”`)
    })
  }

  return (
    <div className="-mx-4 grid snap-x snap-mandatory auto-cols-[min(18rem,82vw)] grid-flow-col gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:-mx-8 sm:px-8 lg:mx-0 lg:auto-cols-fr lg:px-0">
      {TASK_STATUSES.map((status) => {
        const col = tasks.filter((t) => statusOf(t) === status)
        return (
          <section
            key={status}
            aria-label={STATUS[status].label}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
              e.preventDefault()
              e.dataTransfer.dropEffect = "move"
              if (over !== status) setOver(status)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setOver(null)
              const t = tasks.find((x) => x.id === e.dataTransfer.getData(DRAG_TYPE))
              if (t) setStatus(t, status)
            }}
            className={cn(
              "flex min-h-64 snap-start flex-col rounded-tile bg-card/60 p-2 ring-1 ring-foreground/[0.03] backdrop-blur transition-[background-color,box-shadow]",
              over === status && "bg-card/90 ring-2 ring-foreground/15"
            )}
          >
            <h2 className="flex items-center gap-2 px-2.5 pt-2 pb-3 text-sm">
              <span className={cn("size-2 rounded-full bg-current", STATUS[status].className)} />
              {STATUS[status].label}
              <span className="tabular ml-auto text-muted-foreground">{col.length}</span>
            </h2>
            <ul className="flex flex-1 flex-col gap-2">
              <AnimatePresence mode="popLayout" initial={false}>
                {col.map((t) => (
                  <BoardCard key={t.id} task={t} status={statusOf(t)} onMove={(s) => setStatus(t, s)} />
                ))}
              </AnimatePresence>
              {col.length === 0 && (
                <li className="grid flex-1 place-items-center rounded-card border-[1.5px] border-dashed border-foreground/10 px-4 py-8 text-center text-xs text-muted-foreground">
                  {status === "completed" ? "Finished in the last 7 days shows here" : "Drop a task here"}
                </li>
              )}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function BoardCard({
  task,
  status,
  onMove,
}: {
  task: BrowserTask
  status: TaskStatus
  onMove: (s: TaskStatus) => void
}) {
  const done = status === "completed"
  const h = HEALTH[done ? "done" : task.health]
  const late = !done && (task.health === "overdue" || task.health === "due_soon")
  return (
    <motion.li
      layout
      layoutId={`board-${task.id}`}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
      transition={spring}
      draggable
      onDragStartCapture={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, task.id)
        e.dataTransfer.effectAllowed = "move"
      }}
      className="group relative cursor-grab rounded-card bg-card p-3.5 shadow-sm ring-1 ring-foreground/[0.04] transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-center gap-1.5 pr-7 text-xs text-muted-foreground">
        <ProjectDot color={task.project.color} />
        <span className="truncate">{task.project.name}</span>
      </div>
      <Link
        href={`/tasks/${task.id}`}
        draggable={false}
        className={cn(
          "mt-1.5 block text-sm leading-snug after:absolute after:inset-0 after:rounded-card",
          done && "text-muted-foreground line-through decoration-foreground/30"
        )}
      >
        {task.title}
      </Link>
      <div className="mt-3 flex items-center gap-2.5 text-xs text-muted-foreground">
        {task.priority === "urgent" && (
          <FlagIcon aria-label={PRIORITY.urgent.label} className={cn("size-3.5 fill-current", PRIORITY.urgent.className)} />
        )}
        {task.deadline && (
          <span className={cn("inline-flex items-center gap-1", late && h.className)}>
            <CalendarIcon className="size-3.5" />
            <span className="tabular">{formatDate(task.deadline)}</span>
          </span>
        )}
        {task.subtasks.total > 0 && (
          <span className="tabular inline-flex items-center gap-1">
            <ListChecksIcon className="size-3.5" />
            {task.subtasks.done}/{task.subtasks.total}
          </span>
        )}
        <UserAvatar user={task.assignee} className="ml-auto size-6 ring-0" />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Move “${task.title}”`}
          className="absolute top-2 right-2 z-10 grid size-7 place-items-center rounded-full text-muted-foreground opacity-100 transition hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-[popup-open]:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {TASK_STATUSES.filter((s) => s !== status).map((s) => (
              <DropdownMenuItem key={s} onClick={() => onMove(s)}>
                <span className={cn("size-2 rounded-full bg-current", STATUS[s].className)} />
                {STATUS[s].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.li>
  )
}
