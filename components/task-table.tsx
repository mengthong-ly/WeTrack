"use client"

import { ChevronDownIcon, PlusIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { useState } from "react"

import { PriorityChip, ProjectDot, UserAvatar } from "@/components/bits"
import { NEW_TASK_EVENT } from "@/components/command-menu"
import { ProgressBar } from "@/components/motion-bits"
import type { BrowserTask } from "@/components/task-browser"
import { TASK_PRIORITIES, type TaskPriority } from "@/lib/db/enums"
import { formatDate, HEALTH, STATUS } from "@/lib/labels"
import { cn } from "@/lib/utils"

// Title takes what's left; the rest are fixed so every group's columns line up.
const COLUMNS = [
  { label: "Title", className: "" },
  { label: "Project", className: "w-36" },
  { label: "Sub-tasks", className: "w-40" },
  { label: "Status", className: "w-32" },
  { label: "Assignee", className: "w-40" },
  { label: "Deadline", className: "w-24" },
]
// Sticky cells need an opaque fill, so the row hover is bg-muted rather than a tint.
const cell = "h-11 border-t border-foreground/5 bg-card px-3 transition-colors group-hover:bg-muted"
const pinned = "sticky left-0 z-10"

// A dense backlog grouped by priority. On narrow screens it scrolls sideways inside its sheet with the
// title column pinned, so the page itself never scrolls horizontally.
export function TaskTable({ tasks }: { tasks: BrowserTask[] }) {
  const [collapsed, setCollapsed] = useState<TaskPriority[]>([])

  return (
    <div className="overflow-x-auto rounded-sheet bg-card p-3 shadow-sm [scrollbar-width:thin] sm:p-4">
      <table className="w-full min-w-4xl table-fixed border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {COLUMNS.map((c, i) => (
              <th
                key={c.label}
                scope="col"
                className={cn("bg-card px-3 pb-2 text-left text-xs font-normal text-muted-foreground", c.className, i === 0 && pinned)}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        {TASK_PRIORITIES.map((priority) => {
          // Deadline order from the server, with finished work sunk to the bottom (sort is stable).
          const rows = tasks
            .filter((t) => t.priority === priority)
            .sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed"))
          const open = !collapsed.includes(priority)
          return (
            <tbody key={priority}>
              <tr>
                <th colSpan={COLUMNS.length} scope="colgroup" className="pt-4 pb-1 text-left font-normal">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() =>
                      setCollapsed((c) => (open ? [...c, priority] : c.filter((p) => p !== priority)))
                    }
                    className="sticky left-0 flex h-10 items-center gap-2 rounded-full pr-3 pl-2 outline-none transition-[background-color,scale] hover:bg-muted active:scale-97 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <ChevronDownIcon
                      className={cn("size-4 text-muted-foreground transition-transform", !open && "-rotate-90")}
                    />
                    <PriorityChip priority={priority} className="bg-muted" />
                    <span className="tabular text-muted-foreground">{rows.length}</span>
                  </button>
                </th>
              </tr>
              <AnimatePresence initial={false}>
                {open && rows.map((t) => <Row key={t.id} task={t} />)}
              </AnimatePresence>
              {open && (
                <tr>
                  <td colSpan={COLUMNS.length} className="border-t border-foreground/5 pt-1">
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent(NEW_TASK_EVENT, { detail: { priority } }))}
                      className="sticky left-0 flex h-10 items-center gap-2 rounded-full px-3 text-muted-foreground outline-none transition-[background-color,color,scale] hover:bg-muted hover:text-foreground active:scale-97 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <PlusIcon className="size-4" />
                      Add task
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}

function Row({ task: t }: { task: BrowserTask }) {
  const done = t.status === "completed"
  const late = !done && (t.health === "overdue" || t.health === "due_soon")
  const { done: subDone, total } = t.subtasks
  const pct = total ? Math.round((subDone / total) * 100) : 0
  const none = <span className="text-muted-foreground">—</span>

  return (
    <motion.tr
      className="group"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
    >
      <td className={cn(cell, pinned)}>
        <Link
          href={`/tasks/${t.id}`}
          className={cn(
            "block truncate outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50",
            done && "text-muted-foreground line-through decoration-foreground/30"
          )}
        >
          {t.title}
        </Link>
      </td>
      <td className={cell}>
        <span className="flex items-center gap-2 text-muted-foreground">
          <ProjectDot color={t.project.color} />
          <span className="truncate">{t.project.name}</span>
        </span>
      </td>
      <td className={cell}>
        {total ? (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular w-8">
              {subDone}/{total}
            </span>
            <ProgressBar value={pct} className="w-14" />
            <span className="tabular">{pct}%</span>
          </span>
        ) : (
          none
        )}
      </td>
      <td className={cell}>
        <span className={cn("flex items-center gap-2", STATUS[t.status].className)}>
          <span className="size-2 shrink-0 rounded-full bg-current" />
          <span className="truncate">{STATUS[t.status].label}</span>
        </span>
      </td>
      <td className={cell}>
        {t.assignee ? (
          <span className="flex items-center gap-2">
            <UserAvatar user={t.assignee} className="size-6 ring-0" />
            <span className="truncate">{t.assignee.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Unassigned</span>
        )}
      </td>
      <td className={cn(cell, "tabular", late ? HEALTH[t.health].className : "text-muted-foreground")}>
        {formatDate(t.deadline) ?? none}
      </td>
    </motion.tr>
  )
}
