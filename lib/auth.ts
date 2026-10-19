import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"
import { organization } from "better-auth/plugins"
import { and, count, eq, gt } from "drizzle-orm"

import { db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { sendEmail } from "@/lib/email"

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  databaseHooks: {
    user: {
      create: {
        // Invite-only: the very first account bootstraps the workspace,
        // everyone after that needs a pending invitation for their email.
        before: async (user) => {
          const [{ users }] = await db.select({ users: count() }).from(schema.user)
          if (users === 0) return
          const invite = await db.query.invitation.findFirst({
            where: and(
              eq(schema.invitation.email, user.email.toLowerCase()),
              eq(schema.invitation.status, "pending"),
              gt(schema.invitation.expiresAt, new Date())
            ),
          })
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
