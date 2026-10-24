import { ArrowLeftIcon, ChevronRightIcon, FlagIcon } from "lucide-react"
import Link from "next/link"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
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

// Round glass icon button for page headers (Back, actions).
export function RoundButton(props: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="grid size-11 place-items-center rounded-full bg-card/70 ring-1 ring-foreground/5 outline-none backdrop-blur transition-[background-color,scale,box-shadow] hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
    />
  )
}

// Focus pages: Back and where you are, in one glass pill ("← Tasks › Parent › This task"). Below sm only
// Back and the nearest link show, so the header fits at 375px.
export function Crumbs({ onBack, trail, current }: { onBack: () => void; trail: { href: string; label: string }[]; current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="flex h-11 min-w-0 items-center gap-1 rounded-full bg-card/70 pr-4 pl-1 text-sm ring-1 ring-foreground/5 backdrop-blur">
      <button
        type="button"
        aria-label="Back"
        onClick={onBack}
        className="grid size-9 shrink-0 place-items-center rounded-full outline-none transition-[background-color,scale] hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
      >
        <ArrowLeftIcon className="size-5" />
      </button>
      {trail.map((t, i) => (
        <span key={t.href} className={cn("flex min-w-0 items-center gap-1", i < trail.length - 1 && "max-sm:hidden")}>
          {i > 0 && <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground/60 max-sm:hidden" />}
          <Link
            href={t.href}
            className="max-w-40 truncate rounded-full px-1 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t.label}
          </Link>
        </span>
      ))}
      <span className="hidden min-w-0 items-center gap-1 sm:flex">
        <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground/60" />
        <span aria-current="page" className="max-w-64 truncate">{current}</span>
      </span>
    </nav>
  )
}


/** The foot of a paged list: a quiet pill for the next page, with how many are left. `bg-muted` inside a white
 *  sheet, the glass pill on the canvas. */
export function LoadMore({
  left,
  pending,
  onClick,
  label = "Show more",
  className,
}: {
  left: number
  pending: boolean
  onClick: () => void
  label?: string
  className?: string
}) {
  if (left <= 0) return null
  return (
    <div className="flex justify-center">
      <Button
        variant="ghost"
        onClick={onClick}
        disabled={pending}
        aria-busy={pending}
        className={cn(
          "h-10 gap-2 rounded-full bg-card/70 px-5 font-normal text-muted-foreground ring-1 ring-foreground/5 backdrop-blur transition-[background-color,color,scale] hover:bg-card hover:text-foreground active:scale-95",
          className
        )}
      >
        {pending ? "Loading…" : label}
        {!pending && <span className="tabular text-xs opacity-70">{left} more</span>}
      </Button>
    </div>
  )
}
