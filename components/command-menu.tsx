"use client"

import {
  CornerDownLeftIcon,
  FolderIcon,
  KanbanIcon,
  LayoutGridIcon,
  ListChecksIcon,
  type LucideIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SunIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

import { ProjectDot, UserAvatar } from "@/components/bits"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { STATUS } from "@/lib/labels"
import type { MemberLite, ProjectLite } from "@/lib/options"
import type { TaskIndexRow } from "@/lib/queries"
import { cn } from "@/lib/utils"

export const NEW_TASK_EVENT = "wetrack:new-task"

type Item = {
  id: string
  group: string
  label: string
  hint?: React.ReactNode
  icon: React.ReactNode
  keywords?: string
  run: () => void
}

const kbd = "grid h-5 min-w-5 place-items-center rounded-md bg-muted px-1 font-sans text-[11px] text-foreground"
const icon = (Icon: LucideIcon) => <Icon className="size-4 text-muted-foreground" />

// ⌘K / Ctrl+K anywhere: jump to a page, task, project or person, or run an action.
export function CommandMenu({
  tasks,
  projects,
  members,
  meId,
}: {
  tasks: TaskIndexRow[]
  projects: ProjectLite[]
  members: MemberLite[]
  meId: string
}) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key?.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const items = useMemo<Item[]>(() => {
    const go = (href: string) => () => router.push(href)
    return [
      { id: "new", group: "Actions", label: "New task", icon: icon(PlusIcon), hint: <kbd className={kbd}>C</kbd>, run: () => window.dispatchEvent(new Event(NEW_TASK_EVENT)) },
      { id: "mine", group: "Actions", label: "My open tasks", icon: icon(UserIcon), run: go(`/tasks?person=${meId}&status=open`) },
      {
        id: "theme",
        group: "Actions",
        label: resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        icon: icon(resolvedTheme === "dark" ? SunIcon : MoonIcon),
        keywords: "theme dark light",
        run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      },
      { id: "home", group: "Go to", label: "Home", icon: icon(LayoutGridIcon), keywords: "dashboard", run: go("/") },
      { id: "tasks", group: "Go to", label: "Tasks", icon: icon(ListChecksIcon), keywords: "list", run: go("/tasks") },
      { id: "board", group: "Go to", label: "Board", icon: icon(KanbanIcon), keywords: "kanban", run: go("/tasks?view=board") },
      { id: "projects", group: "Go to", label: "Projects", icon: icon(FolderIcon), keywords: "clients", run: go("/projects") },
      { id: "team", group: "Go to", label: "Team", icon: icon(UsersIcon), keywords: "workload people", run: go("/team") },
      ...projects.map((p) => ({
        id: `p-${p.id}`,
        group: "Projects",
        label: p.name,
        icon: <ProjectDot color={p.color} className="mx-1" />,
        run: go(`/tasks?project=${p.id}`),
      })),
      ...members.map((m) => ({
        id: `m-${m.id}`,
        group: "People",
        label: m.id === meId ? `${m.name} (me)` : m.name,
        icon: <UserAvatar user={m} className="size-5 ring-0" />,
        run: go(`/tasks?person=${m.id}`),
      })),
      ...tasks.map((t) => ({
        id: `t-${t.id}`,
        group: "Tasks",
        label: t.title,
        keywords: t.projectName,
        icon: <ProjectDot color={t.projectColor} className="mx-1" />,
        hint: <span className={cn("text-xs", STATUS[t.status].className)}>{STATUS[t.status].label}</span>,
        run: go(`/tasks/${t.id}`),
      })),
    ]
  }, [tasks, projects, members, meId, router, resolvedTheme, setTheme])

  const q = query.trim().toLowerCase()
  const shown = useMemo(() => {
    if (!q) return items.filter((i) => i.group !== "Tasks" && i.group !== "People").slice(0, 12)
    const words = q.split(/\s+/)
    const hits = items.filter((i) => {
      const hay = `${i.label} ${i.keywords ?? ""}`.toLowerCase()
      return words.every((w) => hay.includes(w))
    })
    // Keep groups together and cap the long ones.
    const capped: Item[] = []
    for (const g of ["Actions", "Go to", "Projects", "People", "Tasks"]) {
      capped.push(...hits.filter((i) => i.group === g).slice(0, g === "Tasks" ? 8 : 5))
    }
    return capped
  }, [items, q])

  const current = Math.min(active, Math.max(shown.length - 1, 0))

  function choose(i: Item | undefined) {
    if (!i) return
    setOpen(false)
    i.run()
  }

  useEffect(() => {
    list.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" })
  }, [current])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search and commands"
        className="flex h-11 items-center gap-2.5 rounded-full bg-card/70 px-3.5 text-sm text-muted-foreground ring-1 ring-foreground/5 backdrop-blur transition hover:bg-card hover:text-foreground sm:w-56 sm:px-4"
      >
        <SearchIcon className="size-4 shrink-0" />
        <span className="hidden flex-1 text-left sm:inline">Search</span>
        <span className="hidden items-center gap-1 sm:flex">
          <kbd className={kbd}>⌘</kbd>
          <kbd className={kbd}>K</kbd>
        </span>
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) {
            setQuery("")
            setActive(0)
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="top-[12vh] translate-y-0 gap-0 overflow-hidden rounded-tile p-0 sm:max-w-xl"
        >
          <DialogTitle className="sr-only">Search and commands</DialogTitle>
          <div className="flex items-center gap-3 px-5 pt-4 pb-3">
            <SearchIcon className="size-5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault()
                  setActive((current + 1) % Math.max(shown.length, 1))
                } else if (e.key === "ArrowUp") {
                  e.preventDefault()
                  setActive((current - 1 + shown.length) % Math.max(shown.length, 1))
                } else if (e.key === "Enter") {
                  e.preventDefault()
                  choose(shown[current])
                }
              }}
              role="combobox"
              aria-expanded
              aria-controls="command-list"
              aria-activedescendant={shown[current] ? `cmd-${shown[current].id}` : undefined}
              placeholder="Find a task, project or person…"
              className="h-10 w-full min-w-0 bg-transparent text-xl font-light tracking-tight outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div ref={list} id="command-list" role="listbox" className="max-h-[min(26rem,60vh)] overflow-y-auto px-2 pb-2">
            {shown.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">No matches. Try a project or a person’s name.</p>
            )}
            {shown.map((item, i) => (
              <div key={item.id}>
                {item.group !== shown[i - 1]?.group && (
                  <p className="px-3 pt-3 pb-1.5 text-xs text-muted-foreground">{item.group}</p>
                )}
                <div
                  id={`cmd-${item.id}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === current}
                  onMouseMove={() => i !== current && setActive(i)}
                  onClick={() => choose(item)}
                  className={cn(
                    "flex h-11 cursor-pointer items-center gap-3 rounded-row px-3 text-sm",
                    i === current && "bg-muted"
                  )}
                >
                  <span className="grid w-5 shrink-0 place-items-center">{item.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint}
                  {i === current && <CornerDownLeftIcon className="size-3.5 shrink-0 text-muted-foreground" />}
                </div>
              </div>
            ))}
          </div>
          <div className="hidden items-center gap-4 border-t border-foreground/5 px-5 py-3 text-xs text-muted-foreground sm:flex">
            <span className="flex items-center gap-1.5"><kbd className={kbd}>↑</kbd><kbd className={kbd}>↓</kbd> to move</span>
            <span className="flex items-center gap-1.5"><kbd className={kbd}>↵</kbd> to open</span>
            <span className="flex items-center gap-1.5"><kbd className={kbd}>esc</kbd> to close</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
