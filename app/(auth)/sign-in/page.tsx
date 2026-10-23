import type { Metadata } from "next"

import { AuthForm } from "@/components/auth-form"

export const metadata: Metadata = { title: "Sign in" }

export default function SignInPage() {
  return <AuthForm google={!!process.env.GOOGLE_CLIENT_ID} />
}
