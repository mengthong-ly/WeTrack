"use client"

import { motion } from "motion/react"
import Link from "next/link"

import { spring } from "@/components/motion-bits"
import { cn } from "@/lib/utils"

export function PillTabs({
  id,
  items,
  className,
}: {
  id: string
  items: { href: string; label: React.ReactNode; active: boolean }[]
  className?: string
}) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto rounded-full bg-card/70 p-1 ring-1 ring-foreground/5 backdrop-blur [scrollbar-width:none]", className)}>
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          scroll={false}
          aria-current={it.active ? "page" : undefined}
          className={cn(
            "relative flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap transition-colors",
            it.active ? "text-background" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {it.active && (
            <motion.span layoutId={`pill-${id}`} className="absolute inset-0 rounded-full bg-foreground" transition={spring} />
          )}
          <span className="relative flex items-center gap-2">{it.label}</span>
        </Link>
      ))}
    </div>
  )
}
