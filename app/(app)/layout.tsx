import { Suspense } from "react"

import { NewTaskHost } from "@/components/app-sidebar"
import { CommandMenu } from "@/components/command-menu"
import { PushHost } from "@/components/inbox"
import { NewMeetingDialog } from "@/components/new-meeting-dialog"
import { SidebarProvider } from "@/components/ui/sidebar"
import { hasCalendar } from "@/lib/google"
import { listMembers, listProjects, taskIndex } from "@/lib/queries"
import { requireMember } from "@/lib/session"
import { hasSlack } from "@/lib/slack"

const googleEnabled = !!process.env.GOOGLE_CLIENT_ID

// What both modes share. The frame itself is per mode: (org) is project selection (pick or start a project, the
// 3D workspace, the team) and (project)/projects/[projectId] is task management inside one project. Each renders
// its own sidebar through `Frame` (./frame.tsx); the provider stays here, so collapsing the sidebar survives the
// switch. Anything that needs the signed-in user streams into its own boundary.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      {children}
      {/* It reads the path (which project you're in), so it waits for it like any URL data. */}
      <Suspense>
        <NewTaskHost />
      </Suspense>
      <PushHost />
      <Suspense>
        <Dialogs />
      </Suspense>
      <Suspense>
        <Search />
      </Suspense>
    </SidebarProvider>
  )
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

async function Dialogs() {
  const me = await requireMember()
  const [members, calendarConnected, slackConnected] = await Promise.all([listMembers(me.orgId), hasCalendar(me.user.id), hasSlack(me.orgId)])
  const membersLite = members.map(({ id, name, image }) => ({ id, name, image }))
  return <NewMeetingDialog members={membersLite} meId={me.user.id} calendarConnected={calendarConnected} slackConnected={slackConnected} googleEnabled={googleEnabled} />
}
