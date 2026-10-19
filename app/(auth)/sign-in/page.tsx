import type { Metadata } from "next"

import { AuthForm } from "@/components/auth-form"
import { getOpenInvite } from "@/lib/invites"

export const metadata: Metadata = { title: "Sign in" }

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { invite } = await searchParams
  const open = await getOpenInvite(typeof invite === "string" ? invite : undefined)
  return <AuthForm mode="sign-in" email={open?.email} inviteId={open?.id} />
}
