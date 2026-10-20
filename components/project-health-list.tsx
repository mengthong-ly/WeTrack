import Link from "next/link"

import { HealthBadge, ProjectDot } from "@/components/bits"
import { ProgressBar } from "@/components/motion-bits"
import type { projectProgress } from "@/lib/dashboard"
import { formatDate, HEALTH } from "@/lib/labels"

// Projects with health, progress and the next thing due. Home and the CEO page.
export function ProjectHealthList({
  projects,
  href,
}: {
  projects: ReturnType<typeof projectProgress>
  href?: (id: string) => string
}) {
  if (projects.length === 0) return <p className="mt-4 text-sm text-muted-foreground">No project activity yet.</p>
  return (
    <ul className="mt-4 flex flex-col gap-5">
      {projects.map((p) => {
        const name = href ? (
          <Link href={href(p.id)} className="truncate after:absolute after:inset-0 hover:underline">
            {p.name}
          </Link>
        ) : (
          <span className="truncate">{p.name}</span>
        )
        return (
          <li key={p.id} className="relative">
            <div className="flex items-center gap-2 text-sm">
              <ProjectDot color={p.color} />
              {name}
              <HealthBadge health={p.health} className="ml-auto" />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <ProgressBar value={p.progress} className="flex-1" />
              <span className="tabular w-9 text-right text-xs text-muted-foreground">{p.progress}%</span>
            </div>
            <p className="mt-1.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              <span>{p.open} open</span>
              {p.overdue > 0 && <span className={HEALTH.overdue.className}>{p.overdue} overdue</span>}
              {p.next && <span>· next due {formatDate(p.next.deadline)}</span>}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
