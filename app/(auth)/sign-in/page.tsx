import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { AuthForm } from "@/components/auth-form"
import { getSession } from "@/lib/session"

export const metadata: Metadata = { title: "Sign in" }

export default function SignInPage() {
  return (
    <Suspense>
      <SignedOutOnly />
    </Suspense>
  )
}

// Signed in already: off to the app, which sends you on to onboarding if you have no team yet.
// A real session check, not the proxy's cookie check: a stale cookie would bounce between here and "/".
async function SignedOutOnly() {
  if (await getSession()) redirect("/")
  return <AuthForm google={!!process.env.GOOGLE_CLIENT_ID} />
}
