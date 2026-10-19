import { count } from "drizzle-orm"
import type { Metadata } from "next"
import Link from "next/link"

import { AuthForm } from "@/components/auth-form"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { getOpenInvite } from "@/lib/invites"

export const metadata: Metadata = { title: "Create account" }

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const { invite } = await searchParams
  const open = await getOpenInvite(typeof invite === "string" ? invite : undefined)
  const [{ users }] = await db.select({ users: count() }).from(user)

  if (users > 0 && !open) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-xl font-medium">Invite only</h1>
        <p className="text-sm text-muted-foreground">
          Ask a teammate to invite you, then open the link from your email.
        </p>
        <Link href="/sign-in" className="text-sm underline-offset-4 hover:underline">Back to sign in</Link>
      </div>
    )
  }
  return <AuthForm mode="sign-up" email={open?.email} inviteId={open?.id} />
}
