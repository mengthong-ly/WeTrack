import { AlertTriangleIcon, BanIcon, HourglassIcon, UserXIcon } from "lucide-react"
import Link from "next/link"

import { ProjectDot } from "@/components/bits"
import { type Attention, type needsAttention, STALE_DAYS } from "@/lib/dashboard"
import { HEALTH, STATUS } from "@/lib/labels"
import { cn } from "@/lib/utils"

const REASON: Record<Attention, { label: string; icon: typeof BanIcon; className: string }> = {
  overdue: { label: "Overdue", icon: AlertTriangleIcon, className: HEALTH.overdue.className },
  blocked: { label: "Blocked", icon: BanIcon, className: STATUS.blocked.className },
  stale: { label: `No update in ${STALE_DAYS}+ days`, icon: HourglassIcon, className: HEALTH.due_soon.className },
  unassigned: { label: "Nobody on it", icon: UserXIcon, className: "text-muted-foreground" },
}

// Overdue, blocked, gone quiet, or unowned. Home and the CEO page.
export function AttentionList({
  items,
  href,
  limit = 6,
}: {
  items: ReturnType<typeof needsAttention>
  href?: (id: string) => string
  limit?: number
}) {
  if (items.length === 0)
    return <p className="mt-4 text-sm text-muted-foreground">Nothing stuck. Every open task is moving and has an owner.</p>
  return (
    <ul className="mt-4 flex flex-col gap-3.5">
      {items.slice(0, limit).map(({ task: t, reason }) => {
        const r = REASON[reason]
        return (
          <li key={t.id} className="relative flex items-start gap-3 text-sm">
            <r.icon className={cn("mt-0.5 size-4 shrink-0", r.className)} aria-hidden />
            <span className="min-w-0 flex-1">
              {href ? (
                <Link href={href(t.id)} className="block truncate after:absolute after:inset-0 hover:underline">
                  {t.title}
                </Link>
              ) : (
                <span className="block truncate">{t.title}</span>
              )}
              <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                <span className={r.className}>{r.label}</span>
                <span>·</span>
                <ProjectDot color={t.project.color} />
                {t.project.name}
                {t.assignee && <span>· {t.assignee.name.split(" ")[0]}</span>}
              </span>
            </span>
          </li>
        )
      })}
      {items.length > limit && <li className="text-xs text-muted-foreground">and {items.length - limit} more</li>}
    </ul>
  )
}
