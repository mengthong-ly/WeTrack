import Link from "next/link"

import { AppDock } from "@/components/app-dock"
import { Logo } from "@/components/logo"
import { UserMenu } from "@/components/user-menu"
import { listMembers, listProjects } from "@/lib/queries"
import { requireMember } from "@/lib/session"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMember()
  const [projects, members] = await Promise.all([listProjects(me.orgId), listMembers(me.orgId)])

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-40 sm:px-8 sm:pt-10">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" aria-label="WeTrack home">
            <Logo className="text-3xl sm:text-4xl" />
          </Link>
          <UserMenu user={me.user} orgName={me.orgName} />
        </header>
        {children}
      </div>
      <AppDock
        projects={projects.map(({ id, name, color }) => ({ id, name, color }))}
        members={members.map(({ id, name, image }) => ({ id, name, image }))}
        meId={me.user.id}
      />
    </>
  )
}
