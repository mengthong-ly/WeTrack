import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"

import { Logo } from "@/components/logo"
import { WorkspaceForm } from "@/components/workspace-form"
import { db } from "@/lib/db"
import { member } from "@/lib/db/schema"
import { getSession } from "@/lib/session"

export default async function OnboardingPage() {
  const session = await getSession()
  if (!session) redirect("/sign-in")
  const existing = await db.query.member.findFirst({ where: eq(member.userId, session.user.id) })
  if (existing) redirect("/")

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 p-4">
      <Logo className="text-4xl" />
      <div className="w-full max-w-sm rounded-[2rem] bg-card p-8 shadow-sm">
        <h1 className="text-xl font-medium">Name your workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">Usually your team or company.</p>
        <WorkspaceForm />
      </div>
    </main>
  )
}
