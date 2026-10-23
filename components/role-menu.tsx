"use client"

import { ChevronDownIcon } from "lucide-react"
import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"

import { removeMember, setMemberRole } from "@/app/actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const chip = "rounded-full bg-muted px-3 py-1 text-xs capitalize"

const ROLES = [
  { value: "admin", label: "Admin", hint: "Shares the join code, CEO link and Slack" },
  { value: "member", label: "Member", hint: "Works on projects and tasks" },
] as const

// The role chip on Team. The owner gets a menu on everyone else's; everyone else sees the chip.
export function RoleMenu({
  person,
  editable,
}: {
  person: { id: string; name: string; role: string }
  editable: boolean
}) {
  const [role, setRole] = useOptimistic(person.role)
  const [pending, start] = useTransition()
  if (!editable || role === "owner") return <span className={chip}>{role}</span>

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Role for ${person.name}`}
        disabled={pending}
        className={`${chip} relative z-10 flex items-center gap-1 transition-[background-color,scale] hover:bg-foreground/10 active:scale-95`}
      >
        {role}
        <ChevronDownIcon className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Role</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={role}
            onValueChange={(next: (typeof ROLES)[number]["value"]) =>
              start(async () => {
                setRole(next)
                const res = await setMemberRole(person.id, next)
                if (res.error) toast.error(res.error)
              })
            }
          >
            {ROLES.map((r) => (
              <DropdownMenuRadioItem key={r.value} value={r.value} closeOnClick className="flex-col items-start gap-0 py-1.5">
                {r.label}
                <span className="text-xs text-muted-foreground">{r.hint}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() =>
            start(async () => {
              if (!confirm(`Remove ${person.name} from the team? They lose access right away. Their tasks stay as they are.`)) return
              const res = await removeMember(person.id)
              if (res.error) toast.error(res.error)
              else toast.success(`Removed ${person.name}`)
            })
          }
        >
          Remove from team
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
