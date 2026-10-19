"use client"

import { CalendarIcon, ListChecksIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"

import { updateTask } from "@/app/actions"
import { PriorityChip, ProjectDot, StatusText, UserAvatar } from "@/components/bits"
import { ProgressBar, spring } from "@/components/motion-bits"
import type { TaskPriority, TaskStatus } from "@/lib/db/enums"
import { formatDate, HEALTH } from "@/lib/labels"
import type { Health } from "@/lib/schedule"
import { cn } from "@/lib/utils"

export type TaskCardData = {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  deadline: string | null
  progress: number
  health: Health
  project: { name: string; color: string }
  assignee: { name: string; image: string | null } | null
  subtasks: { done: number; total: number }
}

export function TaskCard({ task, index = 0 }: { task: TaskCardData; index?: number }) {
  const [, start] = useTransition()
  const [done, setDone] = useOptimistic(task.status === "completed")
  const health = HEALTH[done ? "done" : task.health]

  function toggle() {
    start(async () => {
      setDone(!done)
      const res = await updateTask(task.id, { status: done ? "in_progress" : "completed" })
      if (res.error) toast.error(res.error)
      else if (!done) toast.success(`Completed “${task.title}”`)
    })
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
      transition={{ ...spring, delay: Math.min(index, 8) * 0.035 }}
      className="group relative rounded-[1.75rem] bg-muted/80 p-4 transition-colors hover:bg-muted sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
        <PriorityChip priority={task.priority} />
        {task.deadline && (
          <span className={cn("inline-flex items-center gap-1.5", !done && task.health !== "on_track" && health.className)}>
            <CalendarIcon className="size-4" />
            {formatDate(task.deadline)}
            {!done && (task.health === "overdue" || task.health === "due_soon") && (
              <span className="font-medium">· {health.label}</span>
            )}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <ProjectDot color={task.project.color} />
          {task.project.name}
        </span>
        <UserAvatar user={task.assignee} className="ml-auto" />
      </div>

      <div className="mt-3 flex items-start gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={done ? "Mark as not done" : "Mark as done"}
          aria-pressed={done}
          className="relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] border-foreground/30 transition-colors hover:border-foreground/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <motion.span
            className="absolute inset-0 rounded-full bg-foreground"
            initial={false}
            animate={{ scale: done ? 1 : 0 }}
            transition={spring}
          />
          <motion.svg viewBox="0 0 24 24" className="relative size-3.5 text-background" fill="none">
            <motion.path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={{ pathLength: done ? 1 : 0 }}
              transition={{ duration: 0.25, delay: done ? 0.08 : 0 }}
            />
          </motion.svg>
        </button>
        <div className="min-w-0 flex-1">
          <Link
            href={`/tasks/${task.id}`}
            className={cn(
              "block text-lg leading-snug transition-colors after:absolute after:inset-0 after:rounded-[1.75rem] sm:text-xl",
              done && "text-muted-foreground line-through decoration-foreground/30"
            )}
          >
            {task.title}
          </Link>
          {task.description && (
            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{task.description}</p>
          )}
        </div>
      </div>

      {(task.subtasks.total > 0 || task.status === "in_progress" || task.status === "review" || task.status === "blocked") && !done && (
        <div className="mt-4 flex items-center gap-3 pl-9 text-xs text-muted-foreground">
          <ProgressBar value={task.progress} className="max-w-48 flex-1" />
          <span className="tabular">{task.progress}%</span>
          {task.subtasks.total > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListChecksIcon className="size-3.5" />
              {task.subtasks.done}/{task.subtasks.total}
            </span>
          )}
          <StatusText status={task.status} className="ml-auto text-xs" />
        </div>
      )}
    </motion.li>
  )
}

export function TaskList({ tasks, empty }: { tasks: TaskCardData[]; empty?: React.ReactNode }) {
  if (tasks.length === 0) return <>{empty}</>
  return (
    <motion.ul layout className="relative flex flex-col gap-2.5">
      <AnimatePresence mode="popLayout" initial={false}>
        {tasks.map((t, i) => (
          <TaskCard key={t.id} task={t} index={i} />
        ))}
      </AnimatePresence>
    </motion.ul>
  )
}
