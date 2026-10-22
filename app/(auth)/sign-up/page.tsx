import type { Metadata } from "next"

import { AuthForm } from "@/components/auth-form"

export const metadata: Metadata = { title: "Create account" }

export default function SignUpPage() {
  return <AuthForm mode="sign-up" google={!!process.env.GOOGLE_CLIENT_ID} />
}
