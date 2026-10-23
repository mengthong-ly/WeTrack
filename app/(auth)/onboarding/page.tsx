import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { GetStarted } from "@/components/get-started"
import { db } from "@/lib/db"
import { member } from "@/lib/db/schema"
import { getSession } from "@/lib/session"

export const metadata: Metadata = { title: "Get started" }

// Signed in but not in a team yet: nothing to see until you create one or join with a code.
export default async function OnboardingPage() {
  const session = await getSession()
  if (!session) redirect("/sign-in")
  const existing = await db.query.member.findFirst({ where: eq(member.userId, session.user.id) })
  if (existing) redirect("/")
  return <GetStarted email={session.user.email} />
}
