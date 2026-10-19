import { count } from "drizzle-orm"
import type { Metadata } from "next"
import Link from "next/link"

import { AuthForm } from "@/components/auth-form"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { getOpenInvite } from "@/lib/invites"

export const metadata: Metadata = { title: "Create account" }

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const { invite, setup } = await searchParams
  const open = await getOpenInvite(typeof invite === "string" ? invite : undefined)
  const [{ users }] = await db.select({ users: count() }).from(user)

  if (users === 0) {
    // First account = workspace owner. The setup token is checked again on the server.
    if (typeof setup !== "string") {
      return (
        <div className="flex flex-col gap-3 text-center">
          <h1 className="text-xl font-medium">Setup link needed</h1>
          <p className="text-sm text-muted-foreground">
            Open <code className="rounded bg-muted px-1">/sign-up?setup=&lt;SETUP_TOKEN&gt;</code> using the token from
            the server&apos;s environment to create the owner account.
          </p>
        </div>
      )
    }
    return <AuthForm mode="sign-up" setupToken={setup} />
  }
  if (!open) {
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
