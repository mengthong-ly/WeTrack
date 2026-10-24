import { Suspense } from "react"

import { AppDock, NewTaskHost } from "@/components/app-dock"
import { SideRail } from "@/components/app-sidebar"
import { CommandMenu } from "@/components/command-menu"
import { MeetingBanner } from "@/components/meeting-banner"
import { NewMeetingDialog } from "@/components/new-meeting-dialog"
import { HeaderToolsSkeleton } from "@/components/page-skeleton"
import { UserMenu } from "@/components/user-menu"
import { hasCalendar } from "@/lib/google"
import { bannerMeetings, listMembers, listProjects, taskIndex, upcomingMeetings } from "@/lib/queries"
import { requireMember } from "@/lib/session"
import { hasSlack } from "@/lib/slack"

const googleEnabled = !!process.env.GOOGLE_CLIENT_ID

// The frame (rail, dock, tool shapes) is static, so it's in every link's prefetched shell. The parts that need
// the signed-in user stream into their own boundaries; requireMember and the shared queries are cached per
// request, so the pieces don't repeat the work. There is no header: pages use the full width, with a floating
// icon rail on the left from lg and the dock below that, each with search and account by the "+". Focus pages
// (`data-focus`) hide the rail and the dock's tools.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SideRail account={<Account side="right" />} />
      <div className="w-full px-4 pt-6 pb-56 sm:px-8 sm:pt-8 lg:pb-12 lg:pl-28 lg:focus-page:pl-8">
        <div className="relative z-10">
          <Suspense>
            <Banner />
          </Suspense>
        </div>
        {children}
      </div>
      <div className="lg:hidden">
        <AppDock account={<Account side="top" />} />
      </div>
      <NewTaskHost />
      <Suspense>
        <Dialogs />
      </Suspense>
      <Suspense>
        <Search />
      </Suspense>
    </>
  )
}

function Account({ side }: { side: "top" | "right" }) {
  return (
    <Suspense fallback={<HeaderToolsSkeleton />}>
      <AccountMenu side={side} />
    </Suspense>
  )
}

async function AccountMenu({ side }: { side: "top" | "right" }) {
  const me = await requireMember()
  const calendarConnected = await hasCalendar(me.user.id)
  return <UserMenu user={me.user} orgName={me.orgName} googleEnabled={googleEnabled} calendarConnected={calendarConnected} side={side} />
}

async function Search() {
  const me = await requireMember()
  const [projects, members, tasks] = await Promise.all([listProjects(me.orgId), listMembers(me.orgId), taskIndex(me.orgId)])
  return (
    <CommandMenu
      tasks={tasks}
      projects={projects.map(({ id, name, color }) => ({ id, name, color }))}
      members={members.map(({ id, name, image }) => ({ id, name, image }))}
      meId={me.user.id}
    />
  )
}

async function Banner() {
  const me = await requireMember()
  const soon = await upcomingMeetings(me.orgId, { email: me.user.email, userId: me.user.id, days: 1 })
  return <MeetingBanner meetings={bannerMeetings(soon, { userId: me.user.id, email: me.user.email, role: me.role })} />
}

async function Dialogs() {
  const me = await requireMember()
  const [members, calendarConnected, slackConnected] = await Promise.all([listMembers(me.orgId), hasCalendar(me.user.id), hasSlack(me.orgId)])
  const membersLite = members.map(({ id, name, image }) => ({ id, name, image }))
  return <NewMeetingDialog members={membersLite} meId={me.user.id} calendarConnected={calendarConnected} slackConnected={slackConnected} googleEnabled={googleEnabled} />
}
