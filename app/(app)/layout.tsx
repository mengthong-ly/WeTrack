import Link from "next/link"
import { Suspense } from "react"

import { AppDock, NewTaskHost } from "@/components/app-dock"
import { SideRail } from "@/components/app-sidebar"
import { CommandMenu } from "@/components/command-menu"
import { Logo } from "@/components/logo"
import { MeetingBanner } from "@/components/meeting-banner"
import { NewMeetingDialog } from "@/components/new-meeting-dialog"
import { HeaderToolsSkeleton } from "@/components/page-skeleton"
import { UserMenu } from "@/components/user-menu"
import { hasCalendar } from "@/lib/google"
import { bannerMeetings, listMembers, listProjects, taskIndex, upcomingMeetings } from "@/lib/queries"
import { requireMember } from "@/lib/session"

const googleEnabled = !!process.env.GOOGLE_CLIENT_ID

// The frame (rail, logo, dock, header shapes) is static, so it's in every link's prefetched shell. The
// parts that need the signed-in user stream into their own boundaries; requireMember and the shared queries
// are cached per request, so the pieces don't repeat the work. Pages use the full width: a floating icon rail
// on the left from lg, the dock below that. Focus pages (`data-focus`) hide the header and the rail.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SideRail />
      <div className="w-full px-4 pt-6 pb-40 sm:px-8 sm:pt-8 lg:pb-12 lg:pl-28 lg:focus-page:pl-8">
        {/* Above the 3D workspace, which fills the screen behind it. */}
        <header data-app-header className="relative z-10 mb-8 flex items-center justify-between">
          <Link href="/" aria-label="WeTrack home">
            <Logo className="text-3xl sm:text-4xl" />
          </Link>
          <Suspense fallback={<HeaderToolsSkeleton />}>
            <HeaderTools />
          </Suspense>
        </header>
        <div className="relative z-10">
          <Suspense>
            <Banner />
          </Suspense>
        </div>
        {children}
      </div>
      <div className="lg:hidden">
        <AppDock />
      </div>
      <NewTaskHost />
      <Suspense>
        <Dialogs />
      </Suspense>
    </>
  )
}

async function HeaderTools() {
  const me = await requireMember()
  const [projects, members, tasks, calendarConnected] = await Promise.all([
    listProjects(me.orgId),
    listMembers(me.orgId),
    taskIndex(me.orgId),
    hasCalendar(me.user.id),
  ])
  return (
    <div className="flex items-center gap-2">
      <CommandMenu
        tasks={tasks}
        projects={projects.map(({ id, name, color }) => ({ id, name, color }))}
        members={members.map(({ id, name, image }) => ({ id, name, image }))}
        meId={me.user.id}
      />
      <UserMenu user={me.user} orgName={me.orgName} googleEnabled={googleEnabled} calendarConnected={calendarConnected} />
    </div>
  )
}

async function Banner() {
  const me = await requireMember()
  const soon = await upcomingMeetings(me.orgId, { email: me.user.email, userId: me.user.id, days: 1 })
  return <MeetingBanner meetings={bannerMeetings(soon, { userId: me.user.id, email: me.user.email, role: me.role })} />
}

async function Dialogs() {
  const me = await requireMember()
  const [members, calendarConnected] = await Promise.all([listMembers(me.orgId), hasCalendar(me.user.id)])
  const membersLite = members.map(({ id, name, image }) => ({ id, name, image }))
  return <NewMeetingDialog members={membersLite} meId={me.user.id} calendarConnected={calendarConnected} googleEnabled={googleEnabled} />
}
