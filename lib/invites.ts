import "server-only"

import { and, eq, gt } from "drizzle-orm"

import { db } from "@/lib/db"
import { invitation, organization } from "@/lib/db/schema"

export async function getPendingInvites(email: string) {
  return db
    .select({ id: invitation.id, orgName: organization.name })
    .from(invitation)
    .innerJoin(organization, eq(organization.id, invitation.organizationId))
    .where(
      and(
        eq(invitation.email, email.toLowerCase()),
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, new Date())
      )
    )
}
