import "server-only"

import { asc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { member, organization } from "@/lib/db/schema"

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }))

// Every page and server action goes through this: signed in + member of a workspace.
// WeTrack is one workspace per team, so the user's first membership is the workspace.
export const requireMember = cache(async () => {
  const session = await getSession()
  if (!session) redirect("/sign-in")
  const [m] = await db
    .select({ orgId: member.organizationId, role: member.role, orgName: organization.name })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, session.user.id))
    .orderBy(asc(member.createdAt))
    .limit(1)
  if (!m) redirect("/onboarding")
  return { user: session.user, ...m }
})
