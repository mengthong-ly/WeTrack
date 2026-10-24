"use client"

import { PlusIcon } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Suspense, useRef } from "react"

import { NAV, SearchButton } from "@/components/app-dock"
import { NEW_TASK_EVENT } from "@/components/command-menu"
import { spring, useHoldHoverInTransitions } from "@/components/motion-bits"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// Desktop navigation (lg+): the dock stood on its end. A floating glass rail of the six places, icons only
// with their names in tooltips, and the dark "+" for a new task under it. Phones use the dock.
// The links are static, so the rail is in every prefetched shell. Search and `account` sit at its foot (no header).
export function SideRail({ account }: { account?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useHoldHoverInTransitions(ref)
  return (
    <div ref={ref} data-app-sidebar className="fixed top-1/2 left-4 z-30 hidden -translate-y-1/2 flex-col items-center gap-3 lg:flex">
      {/* The path is unknown while a dynamic route prerenders; the links show with no active pill until it streams in. */}
      <Suspense fallback={<Links pathname={null} />}>
        <CurrentLinks />
      </Suspense>
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
              className="grid size-13 place-items-center rounded-full bg-foreground text-background shadow-xl shadow-black/20 focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
          }
        >
          <PlusIcon className="size-6" />
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10} className="rounded-full py-1.5 pr-1.5 pl-3">
          New task
          <kbd data-slot="kbd" className="grid h-5 min-w-5 place-items-center bg-background/15 px-1 font-sans text-[11px]">
            C
          </kbd>
        </TooltipContent>
      </Tooltip>
      <div className="mt-3 flex flex-col items-center gap-2">
        <SearchButton side="right" />
        {account}
      </div>
    </div>
  )
}

function CurrentLinks() {
  return <Links pathname={usePathname()} />
}

function Links({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Main"
      className="flex flex-col items-center gap-1 rounded-full bg-card/85 p-1.5 shadow-lg ring-1 shadow-black/5 ring-foreground/5 backdrop-blur-xl"
    >
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : !!pathname?.startsWith(href)
        return (
          <Tooltip key={href}>
            <TooltipTrigger
              delay={400}
              render={
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative grid size-11 place-items-center rounded-full outline-none transition-[color,scale] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                />
              }
            >
              {active && <motion.span layoutId="rail-pill" className="absolute inset-0 rounded-full bg-muted" transition={spring} />}
              <Icon className="relative size-5" />
              <span className="sr-only">{label}</span>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10} className="rounded-full px-3 py-1.5">
              {label}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </nav>
  )
}
