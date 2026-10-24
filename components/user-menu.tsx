"use client"

import { CalendarCheckIcon, CalendarPlusIcon, LogOutIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { UserAvatar } from "@/components/bits"
import { connectGoogle } from "@/components/connect-google"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"

export function UserMenu({
  user,
  orgName,
  googleEnabled,
  calendarConnected,
  side,
}: {
  user: { name: string; email: string; image?: string | null }
  orgName: string
  googleEnabled: boolean
  calendarConnected: boolean
  side?: "top" | "right"
}) {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account"
        className="grid size-11 place-items-center rounded-full bg-card/85 shadow-lg ring-1 shadow-black/5 ring-foreground/5 backdrop-blur-xl transition-[scale] active:scale-95"
      >
        <UserAvatar user={user} className="size-8 ring-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="end" sideOffset={10} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {user.name}
            </span>
            <span className="text-xs font-normal">{user.email}</span>
            <span className="mt-1 text-xs font-normal">{orgName}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {googleEnabled &&
          (calendarConnected ? (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-1.5 text-sm font-normal [&_svg]:size-4">
                <CalendarCheckIcon />
                Google Calendar connected
              </DropdownMenuLabel>
            </DropdownMenuGroup>
          ) : (
            <DropdownMenuItem onClick={() => connectGoogle()}>
              <CalendarPlusIcon />
              Connect Google Calendar
            </DropdownMenuItem>
          ))}
        <DropdownMenuItem
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
          {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            await authClient.signOut()
            // A full load, not router.push: Next keeps recent pages alive (hidden) in memory, and
            // the next person to sign in on this tab mustn't find the last one's pages there.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- the full load is the point
            window.location.href = "/sign-in"
          }}
        >
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
