"use client"

import { FolderIcon, LayoutGridIcon, ListChecksIcon, PlusIcon, UsersIcon } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

import { NEW_TASK_EVENT } from "@/components/command-menu"
import { spring } from "@/components/motion-bits"
import { NewTaskDialog } from "@/components/new-task-dialog"
import type { MemberLite, ProjectLite } from "@/lib/options"
import { cn, isTyping } from "@/lib/utils"

const NAV = [
  { href: "/", label: "Home", icon: LayoutGridIcon },
  { href: "/tasks", label: "Tasks", icon: ListChecksIcon },
  { href: "/projects", label: "Projects", icon: FolderIcon },
  { href: "/team", label: "Team", icon: UsersIcon },
]

// Floating pill nav + dark "+" button, like the reference screens.
export function AppDock(props: { projects: ProjectLite[]; members: MemberLite[]; meId: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key?.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    const onNew = () => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener(NEW_TASK_EVENT, onNew)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(NEW_TASK_EVENT, onNew)
    }
  }, [])

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto flex items-center gap-3">
          <nav
            aria-label="Main"
            className="flex items-center gap-1 rounded-full bg-card/85 p-1.5 shadow-lg ring-1 shadow-black/5 ring-foreground/5 backdrop-blur-xl"
          >
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
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
                  <span className={cn("relative", active ? "inline" : "sr-only sm:not-sr-only sm:hidden")}>{label}</span>
                </Link>
              )
            })}
          </nav>
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
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
      <NewTaskDialog open={open} onOpenChange={setOpen} {...props} />
    </>
  )
}
