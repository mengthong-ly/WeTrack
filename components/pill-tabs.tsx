"use client"

import { motion } from "motion/react"
import Link from "next/link"

import { spring } from "@/components/motion-bits"
import { cn } from "@/lib/utils"

type Item = { key?: string; label: React.ReactNode; active: boolean } & (
  | { href: string; onSelect?: never } // navigates (server re-renders the page)
  | { href?: never; onSelect: () => void } // client-only (no round trip, nothing remounts)
)

export function PillTabs({
  id,
  items,
  className,
}: {
  id: string
  items: Item[]
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex [scrollbar-width:none] gap-1 overflow-x-auto rounded-full bg-card/70 p-1 ring-1 ring-foreground/5 backdrop-blur",
        className
      )}
    >
      {items.map((it) => {
        const className = cn(
          "relative flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap transition-colors",
          it.active
            ? "text-background"
            : "text-muted-foreground hover:text-foreground"
        )
        const inner = (
          <>
            {it.active && (
              <motion.span
                layoutId={`pill-${id}`}
                className="absolute inset-0 rounded-full bg-foreground"
                transition={spring}
              />
            )}
            <span className="relative flex items-center gap-2">{it.label}</span>
          </>
        )
        return it.href ? (
          <Link
            key={it.key ?? it.href}
            href={it.href}
            scroll={false}
            aria-current={it.active ? "page" : undefined}
            className={className}
          >
            {inner}
          </Link>
        ) : (
          <button
            key={it.key}
            type="button"
            onClick={it.onSelect}
            aria-pressed={it.active}
            className={className}
          >
            {inner}
          </button>
        )
      })}
    </div>
  )
}
