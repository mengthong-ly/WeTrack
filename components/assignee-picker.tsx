"use client"

import { ChevronDownIcon } from "lucide-react"

import { AvatarStack, UserAvatar } from "@/components/bits"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { MemberLite } from "@/lib/options"
import { cn } from "@/lib/utils"

// Who a task goes to: a menu of the team with a tick per person, so one task can belong to several. The first person
// ticked is the lead. The trigger shows their avatars (or "Unassigned") and reads like the table's other inline controls.
export function AssigneePicker({
  members,
  value,
  onChange,
  className,
  "aria-label": ariaLabel = "Assignees",
}: {
  members: MemberLite[]
  value: string[]
  onChange: (ids: string[]) => void
  className?: string
  "aria-label"?: string
}) {
  const chosen = value.map((id) => members.find((m) => m.id === id)).filter((m): m is MemberLite => !!m)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className={cn(
          "flex h-8 w-full min-w-0 items-center gap-2 rounded-lg px-2.5 text-left text-sm outline-none transition-[background-color,scale] hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-99",
          className
        )}
      >
        {chosen.length === 0 ? (
          <span className="text-muted-foreground">Unassigned</span>
        ) : (
          <>
            <AvatarStack users={chosen} />
            {chosen.length === 1 && <span className="truncate">{chosen[0].name}</span>}
          </>
        )}
        <ChevronDownIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuGroup>
          {members.map((m) => (
            <DropdownMenuCheckboxItem
              key={m.id}
              checked={value.includes(m.id)}
              onCheckedChange={(on) => onChange(on ? [...value, m.id] : value.filter((id) => id !== m.id))}
            >
              <UserAvatar user={m} className="size-5 ring-0" />
              {m.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
