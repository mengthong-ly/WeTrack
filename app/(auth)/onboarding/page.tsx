import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AcceptInvite } from "@/components/accept-invite"
import { WorkspaceForm } from "@/components/workspace-form"
import { db } from "@/lib/db"
import { member } from "@/lib/db/schema"
import { getPendingInvites } from "@/lib/invites"
import { getSession } from "@/lib/session"

export const metadata: Metadata = { title: "Get started" }

// Signed in but not in a workspace yet: join a team you were invited to, or start your own.
export default async function OnboardingPage() {
  const session = await getSession()
  if (!session) redirect("/sign-in")
  const existing = await db.query.member.findFirst({ where: eq(member.userId, session.user.id) })
  if (existing) redirect("/")
  const invites = await getPendingInvites(session.user.email)

  if (invites.length === 0) {
    return (
      <>
        <h1 className="text-xl font-medium">Name your workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">Usually your team or company.</p>
        <WorkspaceForm />
      </>
    )
  }
  return (
    <>
      <h1 className="text-xl font-medium">Join your team</h1>
      <p className="mt-1 text-sm text-muted-foreground">You&apos;ve been invited as {session.user.email}.</p>
      <div className="mt-6 flex flex-col gap-2">
        {invites.map((i) => (
          <AcceptInvite key={i.id} id={i.id} orgName={i.orgName} />
        ))}
      </div>
      <p className="mt-8 text-sm text-muted-foreground">Or start your own workspace</p>
      <WorkspaceForm secondary />
    </>
  )
}
