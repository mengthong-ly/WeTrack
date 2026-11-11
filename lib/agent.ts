import "server-only"

import { AsyncLocalStorage } from "node:async_hooks"

import { and, eq, gt, isNull, sql } from "drizzle-orm"
import { after } from "next/server"

import { bearerToken, hashAgentKey, isAgentKey } from "@/lib/agent-key"
import { db } from "@/lib/db"
import { agentKey, member, organization, user } from "@/lib/db/schema"

// What requireMember() returns. lib/session.ts checks this matches its cookie path, so actions see
// the same shape whether a person or their key is calling. Not imported from session.ts: it imports us.
export type AgentIdentity = {
  user: typeof user.$inferSelect
  orgId: string
  role: string
  orgName: string
  orgLogo: string | null
}

const store = new AsyncLocalStorage<AgentIdentity>()

/** The key's identity inside asAgent(), else undefined. Only requireMember() should read it. */
export const agentIdentity = () => store.getStore()

export const inAgent = () => store.getStore() !== undefined

const NO_STORE = { "Cache-Control": "private, no-store" }

// One body for every failure, so a probe can't tell an unknown key from a revoked or expired one.
const unauthorized = () => Response.json({ error: "Invalid or expired API key" }, { status: 401, headers: NO_STORE })

/** Runs fn as the owner of the request's Bearer key. Outside this, a key authenticates nothing. */
export async function asAgent(req: Request, fn: () => Promise<Response>): Promise<Response> {
  const token = bearerToken(req.headers.get("authorization"))
  if (!token || !isAgentKey(token)) return unauthorized()

  // The member join is what turns a key off when its owner leaves the workspace.
  const [row] = await db
    .select({
      keyId: agentKey.id,
      user,
      orgId: member.organizationId,
      role: member.role,
      orgName: organization.name,
      orgLogo: organization.logo,
    })
    .from(agentKey)
    .innerJoin(member, and(eq(member.organizationId, agentKey.organizationId), eq(member.userId, agentKey.userId)))
    .innerJoin(user, eq(user.id, agentKey.userId))
    .innerJoin(organization, eq(organization.id, agentKey.organizationId))
    .where(and(eq(agentKey.tokenHash, hashAgentKey(token)), isNull(agentKey.revokedAt), gt(agentKey.expiresAt, sql`now()`)))
    .limit(1)
  if (!row) return unauthorized()

  const { keyId, ...identity } = row
  after(() =>
    db
      .update(agentKey)
      .set({ lastUsedAt: new Date() })
      .where(eq(agentKey.id, keyId))
      .catch((e) => console.error(`Agent key ${keyId}: lastUsedAt update failed`, e))
  )

  const res = await store.run(identity, fn)
  res.headers.set("Cache-Control", NO_STORE["Cache-Control"])
  return res
}

/** Maps a server action's { error } result to 404 (not found) or 400, and success to 200 JSON. */
export function fromResult(res: { error?: string }, ok?: unknown): Response {
  if (res.error) {
    return Response.json({ error: res.error }, { status: /not found/i.test(res.error) ? 404 : 400, headers: NO_STORE })
  }
  return Response.json(ok ?? {}, { headers: NO_STORE })
}
