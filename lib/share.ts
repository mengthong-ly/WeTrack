import "server-only"

import { createHash, randomBytes } from "node:crypto"
import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/lib/db"
import { organization, shareLink } from "@/lib/db/schema"

export const newShareToken = () => randomBytes(32).toString("base64url")
export const hashShareToken = (token: string) =>
  createHash("sha256").update(token).digest("hex")

// Resolves a public /r/[token] link to its workspace, or null if unknown or revoked.
export async function resolveShareLink(token: string) {
  if (!/^[\w-]{20,100}$/.test(token)) return null
  const [row] = await db
    .select({
      id: shareLink.id,
      orgId: shareLink.organizationId,
      orgName: organization.name,
    })
    .from(shareLink)
    .innerJoin(organization, eq(organization.id, shareLink.organizationId))
    .where(
      and(
        eq(shareLink.tokenHash, hashShareToken(token)),
        isNull(shareLink.revokedAt)
      )
    )
  if (!row) return null
  await db
    .update(shareLink)
    .set({ lastViewedAt: new Date() })
    .where(eq(shareLink.id, row.id))
  return row
}
