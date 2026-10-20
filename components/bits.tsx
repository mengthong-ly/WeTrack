import { FlagIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { TaskPriority, TaskStatus } from "@/lib/db/enums"
import { initials, PRIORITY, PROJECT_HEALTH, STATUS } from "@/lib/labels"
import type { ProjectHealth } from "@/lib/schedule"
import { cn } from "@/lib/utils"

export function PriorityChip({ priority, className }: { priority: TaskPriority; className?: string }) {
  const p = PRIORITY[priority]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-medium",
        p.className,
        className
      )}
    >
      <FlagIcon className="size-3.5 fill-current" />
      {p.label}
    </span>
  )
}

export function StatusText({ status, className }: { status: TaskStatus; className?: string }) {
  return <span className={cn("text-sm", STATUS[status].className, className)}>{STATUS[status].label}</span>
}

export function UserAvatar({
  user,
  className,
}: {
  user: { name: string; image?: string | null } | null | undefined
  className?: string
}) {
  if (!user) return null
  return (
    <Avatar className={cn("size-7 ring-2 ring-card", className)}>
      {user.image && <AvatarImage src={user.image} alt={user.name} />}
      <AvatarFallback className="text-[10px] font-medium">{initials(user.name)}</AvatarFallback>
    </Avatar>
  )
}

export function ProjectDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: color }} />
}

export function HealthBadge({ health, className }: { health: ProjectHealth; className?: string }) {
  const h = PROJECT_HEALTH[health]
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-xs font-medium", h.className, className)}>
      <span className={cn("size-1.5 rounded-full", h.dot)} />
      {h.label}
    </span>
  )
}
