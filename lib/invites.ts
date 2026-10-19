import "server-only"

import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { invitation, organization } from "@/lib/db/schema"

export async function getOpenInvite(id: string | undefined) {
  if (!id) return null
  const [row] = await db
    .select({ id: invitation.id, email: invitation.email, status: invitation.status, expiresAt: invitation.expiresAt, orgName: organization.name })
    .from(invitation)
    .innerJoin(organization, eq(organization.id, invitation.organizationId))
    .where(eq(invitation.id, id))
  return row && row.status === "pending" && row.expiresAt > new Date() ? row : null
}
