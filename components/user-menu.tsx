"use client"

import { CalendarCheckIcon, CalendarPlusIcon, ChevronsUpDownIcon, LogOutIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { UserAvatar } from "@/components/bits"
import { connectGoogle } from "@/components/connect-google"
import { unsubscribe } from "@/components/inbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { authClient } from "@/lib/auth-client"

export function UserMenu({
  user,
  orgName,
  googleEnabled,
  calendarConnected,
}: {
  user: { name: string; email: string; image?: string | null }
  orgName: string
  googleEnabled: boolean
  calendarConnected: boolean
}) {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <DropdownMenu>
      {/* The sidebar footer row: avatar, name and email; the avatar alone when the sidebar is collapsed. */}
      <DropdownMenuTrigger aria-label="Account" render={<SidebarMenuButton size="lg" className="data-popup-open:bg-sidebar-accent" />}>
        <UserAvatar user={user} className="size-8 ring-0" />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
        </span>
        <ChevronsUpDownIcon className="ml-auto text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-(--anchor-width) min-w-56">
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
            // This browser stops getting the last person's notifications.
            await unsubscribe().catch(() => {})
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
