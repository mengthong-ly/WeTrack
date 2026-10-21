import Link from "next/link"

import { AppDock } from "@/components/app-dock"
import { CommandMenu } from "@/components/command-menu"
import { Logo } from "@/components/logo"
import { MeetingBanner } from "@/components/meeting-banner"
import { NewMeetingDialog } from "@/components/new-meeting-dialog"
import { UserMenu } from "@/components/user-menu"
import { hasCalendar } from "@/lib/google"
import { bannerMeetings, listMembers, listProjects, taskIndex, upcomingMeetings } from "@/lib/queries"
import { requireMember } from "@/lib/session"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMember()
  const [projects, members, tasks, calendarConnected, soon] = await Promise.all([
    listProjects(me.orgId),
    listMembers(me.orgId),
    taskIndex(me.orgId),
    hasCalendar(me.user.id),
    upcomingMeetings(me.orgId, { email: me.user.email, userId: me.user.id, days: 1 }),
  ])
  const projectsLite = projects.map(({ id, name, color }) => ({ id, name, color }))
  const membersLite = members.map(({ id, name, image }) => ({ id, name, image }))
  const googleEnabled = !!process.env.GOOGLE_CLIENT_ID

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-40 sm:px-8 sm:pt-10">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" aria-label="WeTrack home">
            <Logo className="text-3xl sm:text-4xl" />
          </Link>
          <div className="flex items-center gap-2">
            <CommandMenu tasks={tasks} projects={projectsLite} members={membersLite} meId={me.user.id} />
            <UserMenu
              user={me.user}
              orgName={me.orgName}
              googleEnabled={googleEnabled}
              calendarConnected={calendarConnected}
            />
          </div>
        </header>
        <MeetingBanner meetings={bannerMeetings(soon, { userId: me.user.id, email: me.user.email, role: me.role })} />
        {children}
      </div>
      <AppDock
        projects={projectsLite}
        members={membersLite}
        meId={me.user.id}
      />
      <NewMeetingDialog
        members={membersLite}
        meId={me.user.id}
        calendarConnected={calendarConnected}
        googleEnabled={googleEnabled}
      />
    </>
  )
}
