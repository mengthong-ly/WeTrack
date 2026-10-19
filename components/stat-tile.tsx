import type { LucideIcon } from "lucide-react"

import { CountUp, Reveal } from "@/components/motion-bits"
import { cn } from "@/lib/utils"

export function StatTile({
  icon: Icon,
  label,
  value,
  meta,
  metaClassName,
  index,
}: {
  icon: LucideIcon
  label: string
  value: number
  meta?: React.ReactNode
  metaClassName?: string
  index: number
}) {
  return (
    <Reveal index={index} className="flex flex-col rounded-tile bg-card/60 p-5 ring-1 ring-foreground/[0.03] backdrop-blur sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-11 place-items-center rounded-full bg-card shadow-sm">
          <Icon className="size-5" />
        </span>
        {meta && <span className={cn("text-right text-sm text-muted-foreground", metaClassName)}>{meta}</span>}
      </div>
      <span className="mt-6 text-sm text-foreground/80">{label}</span>
      <span className="text-5xl font-light tracking-tight sm:text-6xl">
        <CountUp value={value} />
      </span>
    </Reveal>
  )
}
