"use client"

import { BoxIcon, FolderIcon, LayoutGridIcon, ListChecksIcon, MessageSquareQuoteIcon, PlusIcon, SearchIcon, UsersIcon } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Suspense, useEffect } from "react"

import { NEW_TASK_EVENT, newTaskHref, SEARCH_EVENT, type NewTaskPreset } from "@/components/command-menu"
import { spring } from "@/components/motion-bits"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn, isTyping, whenIdle } from "@/lib/utils"

export const NAV = [
  { href: "/", label: "Home", icon: LayoutGridIcon },
  { href: "/workspace", label: "Workspace", icon: BoxIcon },
  { href: "/tasks", label: "Tasks", icon: ListChecksIcon },
  { href: "/projects", label: "Projects", icon: FolderIcon },
  { href: "/feedback", label: "Feedback", icon: MessageSquareQuoteIcon },
  { href: "/team", label: "Team", icon: UsersIcon },
]

// The round glass search button beside the "+" (rail and dock); opens the CommandMenu. There's no header.
export function SearchButton({ side }: { side: "left" | "right" }) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={400}
        render={
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(SEARCH_EVENT))}
            aria-label="Search and commands"
            className="grid size-11 place-items-center rounded-full bg-card/85 text-muted-foreground shadow-lg ring-1 shadow-black/5 ring-foreground/5 backdrop-blur-xl transition-[color,scale] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95"
          />
        }
      >
        <SearchIcon className="size-5" />
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={10} className="rounded-full py-1.5 pr-1.5 pl-3">
        Search
        <kbd data-slot="kbd" className="grid h-5 min-w-5 place-items-center bg-background/15 px-1 font-sans text-[11px]">
          ⌘K
        </kbd>
      </TooltipContent>
    </Tooltip>
  )
}

// Floating pill nav + dark "+" button, like the reference screens. No data, so it's in the
// prefetched shell; "+" asks NewTaskHost to open the New task page. Search and `account` stack above the "+".
export function AppDock({ account }: { account?: React.ReactNode }) {
  return (
    <Suspense fallback={<Dock pathname={null} account={account} />}>
      <CurrentDock account={account} />
    </Suspense>
  )
}

// The path is unknown while a dynamic route (/tasks/[id]) prerenders: the dock shows with no
// active pill there until it streams in. Everywhere else it resolves in the shell.
function CurrentDock({ account }: { account?: React.ReactNode }) {
  return <Dock pathname={usePathname()} account={account} />
}

function Dock({ pathname, account }: { pathname: string | null; account?: React.ReactNode }) {
  return (
    <div data-app-dock className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      {/* Only the nav and the button column take clicks: the box around them (as tall as the column) would
          otherwise cover whatever sits above the nav, like the workspace's scene controls. */}
      <div className="flex items-end gap-3">
        <nav
          aria-label="Main"
          className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-card/85 p-1.5 sm:gap-1 shadow-lg ring-1 shadow-black/5 ring-foreground/5 backdrop-blur-xl"
        >
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : !!pathname?.startsWith(href)
            return (
              // The name shows on hover and focus. Not for the active link: its label is already on screen from sm.
              <Tooltip key={href} disabled={active}>
                <TooltipTrigger
                  delay={400}
                  render={
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-11 items-center gap-2 rounded-full px-3 text-sm transition-[color,scale] active:scale-95 sm:px-4",
                        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    />
                  }
                >
                  {active && (
                    <motion.span
                      layoutId="dock-pill"
                      className="absolute inset-0 rounded-full bg-muted"
                      transition={spring}
                    />
                  )}
                  <Icon className="relative size-5" />
                  {/* Icons only on phones (six fit at 375px); the active label shows from sm. Always named for screen readers. */}
                  <span className={active ? "relative max-sm:sr-only" : "sr-only"}>{label}</span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={10} className="rounded-full px-3 py-1.5">
                  {label}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </nav>
        <div className="pointer-events-auto flex flex-col items-center gap-2">
          {/* Search and account step aside on focus pages, like the rail; the "+" stays. */}
          <div data-app-header className="flex flex-col items-center gap-2">
            <SearchButton side="left" />
            {account}
          </div>
        <Tooltip>
          <TooltipTrigger
            delay={400}
            render={
              <motion.button
                type="button"
                onClick={() => window.dispatchEvent(new Event(NEW_TASK_EVENT))}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                transition={spring}
                aria-label="New task"
                className="grid size-13 place-items-center rounded-full bg-foreground sm:size-14 text-background shadow-xl shadow-black/20 focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none"
              />
            }
          >
            <PlusIcon className="size-6" />
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={10} className="rounded-full py-1.5 pr-1.5 pl-3">
            New task
            <kbd data-slot="kbd" className="grid h-5 min-w-5 place-items-center bg-background/15 px-1 font-sans text-[11px]">
              C
            </kbd>
          </TooltipContent>
        </Tooltip>
        </div>
      </div>
    </div>
  )
}

// C anywhere, the dock's "+", NEW_TASK_EVENT from ⌘K or a panel: all open the New task page.
export function NewTaskHost() {
  const router = useRouter()
  useEffect(() => {
    const open = (preset?: NewTaskPreset) => router.push(newTaskHref(preset))
    const onKey = (e: KeyboardEvent) => {
      if (e.key?.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault()
        open()
      }
    }
    // NEW_TASK_EVENT may carry defaults: { priority } from a priority group's "Add task" row,
    // { status | projectId | assigneeId } from a panel in the 3D workspace.
    const onNew = (e: Event) => open((e as CustomEvent<NewTaskPreset | null>).detail ?? undefined)
    window.addEventListener("keydown", onKey)
    window.addEventListener(NEW_TASK_EVENT, onNew)
    const cancel = whenIdle(() => router.prefetch("/tasks/new"))
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(NEW_TASK_EVENT, onNew)
      cancel()
    }
  }, [router])
  return null
}
