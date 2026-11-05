import { Suspense } from "react"

import { AppHeader, ProjectSwitcher, SwitcherSkeleton } from "@/components/app-sidebar"
import { Inbox } from "@/components/inbox"
import { MeetingBanner } from "@/components/meeting-banner"
import { HeaderToolsSkeleton } from "@/components/page-skeleton"
import { SidebarInset } from "@/components/ui/sidebar"
import { UserMenu } from "@/components/user-menu"
import { hasCalendar } from "@/lib/google"
import { bannerMeetings, getProject, inbox, listProjects, upcomingMeetings } from "@/lib/queries"
import { requireMember } from "@/lib/session"
import { attachmentSrc } from "@/lib/utils"

const googleEnabled = !!process.env.GOOGLE_CLIENT_ID

// The coss.com frame, shared by both modes: `sidebar` beside an inset white panel whose sticky header holds the
// sidebar toggle, the project switcher, search and the bell. `projectId` is the project in task mode, none in
// project selection mode. The pieces that need the signed-in user stream in on their own.
export function Frame({ sidebar, projectId, children }: { sidebar: React.ReactNode; projectId?: Promise<string>; children: React.ReactNode }) {
  return (
    <>
      {sidebar}
      {/* min-w-0: a wide row on a page (the Tasks filters) mustn't stretch the panel past the screen. */}
      <SidebarInset className="min-w-0 overflow-clip">
        <AppHeader
          switcher={
            <Suspense fallback={<SwitcherSkeleton />}>
              <Switcher projectId={projectId} />
            </Suspense>
          }
          tools={
            <Suspense fallback={<HeaderToolsSkeleton />}>
              <InboxMenu />
            </Suspense>
          }
        />
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-16">
          <div className="relative z-10">
            <Suspense>
              <Banner />
            </Suspense>
          </div>
          {children}
        </div>
      </SidebarInset>
    </>
  )
}

// The account row at the sidebar's foot.
export function Account() {
  return (
    <Suspense fallback={<HeaderToolsSkeleton />}>
      <AccountMenu />
    </Suspense>
  )
}

export function OrgName() {
  return (
    <Suspense>
      <TeamName />
    </Suspense>
  )
}

async function TeamName() {
  return (await requireMember()).orgName
}

async function Switcher({ projectId }: { projectId?: Promise<string> }) {
  const me = await requireMember()
  const [list, current] = await Promise.all([listProjects(me.orgId), projectId])
  // An archived project still opens from its link; keep it in the switcher while you're in it.
  const archived = current && !list.some((p) => p.id === current) ? await getProject(me.orgId, current) : undefined
  const projects = archived ? [...list, archived] : list
  return (
    <ProjectSwitcher
      team={me.orgName}
      current={current}
      projects={projects.map(({ id, name, color, logoId }) => ({ id, name, color, logo: logoId && attachmentSrc(logoId) }))}
    />
  )
}

async function InboxMenu() {
  const me = await requireMember()
  return <Inbox initial={await inbox(me.user.id)} side="bottom" />
}

async function AccountMenu() {
  const me = await requireMember()
  const calendarConnected = await hasCalendar(me.user.id)
  return <UserMenu user={me.user} orgName={me.orgName} googleEnabled={googleEnabled} calendarConnected={calendarConnected} />
}

async function Banner() {
  const me = await requireMember()
  const soon = await upcomingMeetings(me.orgId, { email: me.user.email, userId: me.user.id, days: 1 })
  return <MeetingBanner meetings={bannerMeetings(soon, { userId: me.user.id, email: me.user.email, role: me.role })} />
}
