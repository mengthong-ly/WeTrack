import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { organization } from "better-auth/plugins"
import { adminAc, defaultAc, memberAc, ownerAc } from "better-auth/plugins/organization/access"

import { db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { sendEmail } from "@/lib/email"

// Google is on when its keys are set (the sign-in pages check the same variable).
const google = process.env.GOOGLE_CLIENT_ID
  ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET! }
  : undefined

// Anyone can sign up. A new user then creates a workspace or joins one with its join code
// (app/(auth)/onboarding). Password accounts confirm their email by link before their first sign-in.
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      await sendEmail(user.email, "Confirm your email for WeTrack", `Confirm your email to start using WeTrack:\n\n${url}\n\nIf you didn't sign up, ignore this email.`)
    },
  },
  socialProviders: google && { google },
  // "Connect Google Calendar" links a Google account to the signed-in user. Its address may differ
  // from the WeTrack email (personal sign-up, work calendar); only a signed-in user can link.
  account: { accountLinking: { enabled: true, allowDifferentEmails: true } },
  // Every page and action reads the session: a signed cookie copy saves the database lookup for
  // 5 minutes. The cost: a session revoked elsewhere keeps working until the copy expires.
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  plugins: [
    organization({
      // The owner alone manages people (roles, removal); admins share the join code, CEO link and
      // Slack. Email invites are off for everyone: teammates join with the code.
      roles: {
        owner: defaultAc.newRole({ ...ownerAc.statements, invitation: [] }),
        admin: defaultAc.newRole({ ...adminAc.statements, member: [], invitation: [] }),
        member: memberAc,
      },
      // One workspace per person: the app only uses the first anyway.
      organizationLimit: 1,
    }),
    nextCookies(),
  ],
})
