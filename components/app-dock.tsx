"use client"

import { BoxIcon, FolderIcon, LayoutGridIcon, ListChecksIcon, PlusIcon, UsersIcon } from "lucide-react"
import { motion } from "motion/react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

import { NEW_TASK_EVENT } from "@/components/command-menu"
import { spring } from "@/components/motion-bits"
import type { NewTaskPreset } from "@/components/new-task-dialog"
import type { MemberLite, ProjectLite } from "@/lib/options"
import { cn, isTyping, whenIdle } from "@/lib/utils"

// The dialog (quick capture, pickers, date-fns) is fetched in idle time after the page and mounted
// on the first open, so it stays out of every page's first load.
const loadDialog = () => import("@/components/new-task-dialog").then((m) => m.NewTaskDialog)
const NewTaskDialog = dynamic(loadDialog)

const NAV = [
  { href: "/", label: "Home", icon: LayoutGridIcon },
  { href: "/workspace", label: "Workspace", icon: BoxIcon },
  { href: "/tasks", label: "Tasks", icon: ListChecksIcon },
  { href: "/projects", label: "Projects", icon: FolderIcon },
  { href: "/team", label: "Team", icon: UsersIcon },
]

// Floating pill nav + dark "+" button, like the reference screens. No data, so it's in the
// prefetched shell; "+" asks NewTaskHost (mounted once the signed-in data arrives) to open the dialog.
export function AppDock() {
  return (
    <Suspense fallback={<Dock pathname={null} />}>
      <CurrentDock />
    </Suspense>
  )
}

// The path is unknown while a dynamic route (/tasks/[id]) prerenders: the dock shows with no
// active pill there until it streams in. Everywhere else it resolves in the shell.
function CurrentDock() {
  return <Dock pathname={usePathname()} />
}

function Dock({ pathname }: { pathname: string | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex items-center gap-3">
        <nav
          aria-label="Main"
          className="flex items-center gap-1 rounded-full bg-card/85 p-1.5 shadow-lg ring-1 shadow-black/5 ring-foreground/5 backdrop-blur-xl"
        >
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : !!pathname?.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-11 items-center gap-2 rounded-full px-3.5 text-sm transition-colors sm:px-4",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="dock-pill"
                    className="absolute inset-0 rounded-full bg-muted"
                    transition={spring}
                  />
                )}
                <Icon className="relative size-5" />
                {/* Icons only on phones (five fit at 375px); the active label shows from sm. Always named for screen readers. */}
                <span className={active ? "relative max-sm:sr-only" : "sr-only"}>{label}</span>
              </Link>
            )
          })}
        </nav>
        <motion.button
          type="button"
          onClick={() => window.dispatchEvent(new Event(NEW_TASK_EVENT))}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={spring}
          aria-label="New task"
          className="grid size-13 place-items-center rounded-full bg-foreground sm:size-14 text-background shadow-xl shadow-black/20 focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <PlusIcon className="size-6" />
        </motion.button>
      </div>
    </div>
  )
}

// The New task dialog and its triggers: C anywhere, the dock's "+", NEW_TASK_EVENT from ⌘K or a panel.
export function NewTaskHost(props: { projects: ProjectLite[]; members: MemberLite[]; meId: string }) {
  const [open, setOpen] = useState(false)
  const [opened, setOpened] = useState(false)
  // A fresh object per open, so the dialog resets to these defaults each time.
  const [preset, setPreset] = useState<NewTaskPreset>({})

  useEffect(() => {
    const openNew = (p: NewTaskPreset = {}) => {
      setPreset(p)
      setOpen(true)
      setOpened(true)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key?.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault()
        openNew()
      }
    }
    // NEW_TASK_EVENT may carry defaults: { priority } from a priority group's "Add task" row,
    // { status | projectId | assigneeId } from a station's "+" in the 3D workspace.
    const onNew = (e: Event) => openNew((e as CustomEvent).detail ?? {})
    window.addEventListener("keydown", onKey)
    window.addEventListener(NEW_TASK_EVENT, onNew)
    const cancel = whenIdle(() => void loadDialog())
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(NEW_TASK_EVENT, onNew)
      cancel()
    }
  }, [])

  if (!opened) return null
  return <NewTaskDialog open={open} onOpenChange={setOpen} preset={preset} {...props} />
}
