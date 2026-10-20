import Link from "next/link"

import { AppDock } from "@/components/app-dock"
import { CommandMenu } from "@/components/command-menu"
import { Logo } from "@/components/logo"
import { UserMenu } from "@/components/user-menu"
import { listMembers, listProjects, taskIndex } from "@/lib/queries"
import { requireMember } from "@/lib/session"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMember()
  const [projects, members, tasks] = await Promise.all([
    listProjects(me.orgId),
    listMembers(me.orgId),
    taskIndex(me.orgId),
  ])
  const projectsLite = projects.map(({ id, name, color }) => ({ id, name, color }))
  const membersLite = members.map(({ id, name, image }) => ({ id, name, image }))

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-40 sm:px-8 sm:pt-10">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" aria-label="WeTrack home">
            <Logo className="text-3xl sm:text-4xl" />
          </Link>
          <div className="flex items-center gap-2">
            <CommandMenu tasks={tasks} projects={projectsLite} members={membersLite} meId={me.user.id} />
            <UserMenu user={me.user} orgName={me.orgName} />
          </div>
        </header>
        {children}
      </div>
      <AppDock
        projects={projectsLite}
        members={membersLite}
        meId={me.user.id}
      />
    </>
  )
}
