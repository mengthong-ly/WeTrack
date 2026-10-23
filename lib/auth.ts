import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { emailOTP, organization } from "better-auth/plugins"
import { adminAc, defaultAc, memberAc, ownerAc } from "better-auth/plugins/organization/access"

import { db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { sendEmail } from "@/lib/email"

// Google is on when its keys are set (the sign-in pages check the same variable).
const google = process.env.GOOGLE_CLIENT_ID
  ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET! }
  : undefined

// Anyone can sign in: a 6-digit code goes to their email, and a first sign-in creates the account.
// A new user then creates a workspace or joins one with its join code (app/(auth)/onboarding).
// No passwords: accounts made with one before still sign in by code.
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
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
    emailOTP({
      // Hashed at rest; 5 minutes and 3 tries per code, 3 codes a minute per address (plugin defaults).
      storeOTP: "hashed",
      async sendVerificationOTP({ email, otp }) {
        await sendEmail(email, `${otp} is your WeTrack code`, `Your WeTrack sign-in code is ${otp}. It expires in 5 minutes.\n\nIf you didn't try to sign in, ignore this email.`)
      },
    }),
    nextCookies(),
  ],
})
