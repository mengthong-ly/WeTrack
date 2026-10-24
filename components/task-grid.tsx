"use client"

import { CalendarIcon, ListTreeIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"

import { ProjectDot, StatusText, UserAvatar } from "@/components/bits"
import { spring } from "@/components/motion-bits"
import type { TaskCardData } from "@/components/task-card"
import { formatDate, HEALTH } from "@/lib/labels"
import { cn } from "@/lib/utils"

export type GridTask = TaskCardData & { body: string | null }

// The default Tasks view, like a shelf of documents: each task is a page-shaped card with its title, a
// small rendered preview of its description, and its facts along the foot. The whole card opens the task.
export function TaskGrid({ tasks, empty }: { tasks: GridTask[]; empty: React.ReactNode }) {
  if (tasks.length === 0) return <p className="rounded-card bg-muted/60 px-5 py-6 text-sm text-muted-foreground">{empty}</p>
  return (
    <motion.ul layout className="relative grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]">
      <AnimatePresence mode="popLayout" initial={false}>
        {tasks.map((t, i) => (
          <DocCard key={t.id} task={t} index={i} />
        ))}
      </AnimatePresence>
    </motion.ul>
  )
}

function DocCard({ task, index }: { task: GridTask; index: number }) {
  const done = task.status === "completed"
  const late = !done && (task.health === "overdue" || task.health === "due_soon")
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
      transition={{ ...spring, delay: Math.min(index, 8) * 0.035 }}
    >
      <Link
        href={`/tasks/${task.id}`}
        className="group flex h-80 flex-col rounded-tile bg-card p-5 shadow-sm ring-1 ring-foreground/5 outline-none transition-[box-shadow,scale] hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-99"
      >
        <h3 className={cn("line-clamp-2 text-lg leading-snug", done && "text-muted-foreground line-through decoration-foreground/30")}>
          {task.title}
        </h3>
        <div className="mt-3 mb-3 h-px bg-foreground/5" />
        <div aria-hidden className="min-h-0 flex-1 overflow-hidden mask-b-from-60% mask-b-to-100%">
          {task.body ? <MiniDoc markdown={task.body} /> : <p className="text-xs text-muted-foreground/60">No details yet.</p>}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <ProjectDot color={task.project.color} />
          <span className="min-w-0 truncate">{task.project.name}</span>
          <StatusText status={task.status} className="shrink-0 text-xs" />
          <span className="ml-auto flex shrink-0 items-center gap-2">
            {task.subtasks.total > 0 && (
              <span className="inline-flex items-center gap-1 tabular" title="Sub-tasks done">
                <ListTreeIcon className="size-3.5" />
                {task.subtasks.done}/{task.subtasks.total}
              </span>
            )}
            {task.deadline && (
              <span className={cn("inline-flex items-center gap-1 tabular", late && HEALTH[task.health].className)}>
                <CalendarIcon className="size-3.5" />
                {formatDate(task.deadline)}
              </span>
            )}
            <UserAvatar user={task.assignee} className="size-6 ring-0" />
          </span>
        </div>
      </Link>
    </motion.li>
  )
}

// A thumbnail of the description: headings, lists, checklists, quotes, code and images drawn small, so a
// card reads like the page it opens. Line by line on purpose (no Markdown parser on a grid of dozens).
// ponytail: one block per line; nested lists and multi-line paragraphs flatten, fine at this size.
function MiniDoc({ markdown }: { markdown: string }) {
  // Mark which lines sit inside a ``` fence before drawing; the fence lines themselves are dropped.
  const lines: { raw: string; code: boolean }[] = []
  let code = false
  for (const raw of markdown.split("\n")) {
    if (raw.trim().startsWith("```")) code = !code
    else if (raw.trim() && raw.trim() !== "&nbsp;") lines.push({ raw, code })
    if (lines.length === 18) break
  }
  return (
    <div className="flex flex-col gap-1 text-[11px] leading-relaxed text-foreground/70">
      {lines.map(({ raw, code }, i) => {
        const line = raw.trim()
        if (code) return <code key={i} className="truncate rounded-md bg-muted px-1.5 font-mono text-[10px]">{raw}</code>
        const image = line.match(/^!\[[^\]]*\]\(([^)\s]+)/)
        // eslint-disable-next-line @next/next/no-img-element -- a tiny preview of an attachment, not page content
        if (image) return <img key={i} src={image[1]} alt="" loading="lazy" className="max-h-24 w-full rounded-row bg-muted object-cover object-top" />
        const heading = line.match(/^(#{1,3})\s+(.*)/)
        if (heading)
          return (
            <p key={i} className={cn("text-foreground", heading[1].length === 1 ? "text-sm" : "text-xs", i > 0 && "mt-1")}>
              {inline(heading[2])}
            </p>
          )
        const check = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)/)
        if (check)
          return (
            <p key={i} className="flex items-start gap-1.5">
              <span className={cn("mt-[0.3em] size-2.5 shrink-0 rounded-full border border-foreground/30", check[1] !== " " && "border-foreground bg-foreground")} />
              <span className={cn(check[1] !== " " && "line-through decoration-foreground/30")}>{inline(check[2])}</span>
            </p>
          )
        const bullet = line.match(/^([-*]|\d+\.)\s+(.*)/)
        if (bullet)
          return (
            <p key={i} className="flex gap-1.5 pl-1">
              <span className="shrink-0 text-muted-foreground">{bullet[1].endsWith(".") ? bullet[1] : "•"}</span>
              <span>{inline(bullet[2])}</span>
            </p>
          )
        if (line.startsWith(">")) return <p key={i} className="border-l-2 border-foreground/15 pl-2 text-muted-foreground">{inline(line.replace(/^>\s?/, ""))}</p>
        if (/^(-{3,}|\*{3,})$/.test(line)) return <hr key={i} className="my-1 h-px border-0 bg-foreground/10" />
        return <p key={i}>{inline(line)}</p>
      })}
    </div>
  )
}

// Marks off: **bold**, _em_, `code`, [text](url) read as plain words.
const inline = (s: string) =>
  s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|~~|`)(.*?)\1/g, "$2")
    .replace(/(^|\s)[*_](\S.*?)[*_](?=\s|$)/g, "$1$2")
    .replace(/&nbsp;/g, " ")
