import "server-only"

import { asc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { agentIdentity } from "@/lib/agent"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { member, organization } from "@/lib/db/schema"

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }))

// The cookie path: signed in + member of a workspace.
// WeTrack is one workspace per team, so the user's first membership is the workspace.
const cachedMember = cache(async () => {
  const session = await getSession()
  if (!session) redirect("/sign-in")
  const [m] = await db
    .select({ orgId: member.organizationId, role: member.role, orgName: organization.name, orgLogo: organization.logo })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, session.user.id))
    .orderBy(asc(member.createdAt))
    .limit(1)
  if (!m) redirect("/onboarding")
  return { user: session.user, ...m }
})

type Member = Awaited<ReturnType<typeof cachedMember>>

// Every page and server action goes through this. Inside asAgent() (lib/agent.ts) it is the API key's
// owner instead, read before React cache() so the agent path never touches it.
// The Promise<Member> annotation is the check that an AgentIdentity fits wherever a cookie member does.
export const requireMember = async (): Promise<Member> => agentIdentity() ?? cachedMember()
