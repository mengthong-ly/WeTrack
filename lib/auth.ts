import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { organization } from "better-auth/plugins"

import { db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { sendEmail } from "@/lib/email"

// Google is on when its keys are set (the sign-in pages check the same variable).
const google = process.env.GOOGLE_CLIENT_ID
  ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET! }
  : undefined

// Anyone can sign up. A new user then joins a team they were invited to, or creates a workspace
// (app/(auth)/onboarding). Invites are matched by email, so every signed-in email must be proven:
// password accounts confirm by link before their first sign-in, and Google reports verified emails.
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
  plugins: [
    organization({
      requireEmailVerificationOnInvitation: true,
      // Open sign-up means anyone can send invite emails from us: one workspace per person (the app
      // only uses the first anyway) and at most 20 pending invites per workspace.
      organizationLimit: 1,
      invitationLimit: 20,
      async sendInvitationEmail(data) {
        await sendEmail(
          data.email,
          `${data.inviter.user.name} invited you to ${data.organization.name} on WeTrack`,
          `Join ${data.organization.name} on WeTrack. Sign up or sign in as ${data.email}:\n\n${process.env.BETTER_AUTH_URL}/sign-up\n\nThe invite expires in 48 hours.`
        )
      },
    }),
    nextCookies(),
  ],
})
