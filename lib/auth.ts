import { timingSafeEqual } from "node:crypto"

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"
import { organization } from "better-auth/plugins"
import { and, count, eq, gt } from "drizzle-orm"

import { INVITE_HEADER, SETUP_HEADER } from "@/lib/auth-headers"
import { db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { sendEmail } from "@/lib/email"

// Constant-time compare; an unset secret never matches.
function matches(given: string | null | undefined, secret: string | undefined) {
  if (!given || !secret) return false
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  databaseHooks: {
    user: {
      create: {
        // Invite-only, and every sign-up must prove it came from the right link:
        // - the first account (workspace owner) must send the server's SETUP_TOKEN;
        // - everyone else must send the invite id, which only arrives in the invite email,
        //   so knowing an invited address isn't enough to claim it.
        before: async (user, ctx) => {
          const headers = ctx?.headers
          const [{ users }] = await db.select({ users: count() }).from(schema.user)
          if (users === 0) {
            if (matches(headers?.get(SETUP_HEADER), process.env.SETUP_TOKEN)) return
            throw new APIError("FORBIDDEN", {
              message: "Use the setup link to create the first account (see README).",
            })
          }
          const inviteId = headers?.get(INVITE_HEADER)
          const invite =
            inviteId &&
            (await db.query.invitation.findFirst({
              where: and(
                eq(schema.invitation.id, inviteId),
                eq(schema.invitation.email, user.email.toLowerCase()),
                eq(schema.invitation.status, "pending"),
                gt(schema.invitation.expiresAt, new Date())
              ),
            }))
          if (!invite) {
            throw new APIError("FORBIDDEN", {
              message: "WeTrack is invite-only. Ask a teammate to invite you.",
            })
          }
        },
      },
    },
  },
  plugins: [
    organization({
      async sendInvitationEmail(data) {
        const link = `${process.env.BETTER_AUTH_URL}/invite/${data.id}`
        await sendEmail(
          data.email,
          `${data.inviter.user.name} invited you to ${data.organization.name} on WeTrack`,
          `Join ${data.organization.name} on WeTrack:\n\n${link}\n\nThis link expires in 48 hours.`
        )
      },
    }),
    nextCookies(),
  ],
})
