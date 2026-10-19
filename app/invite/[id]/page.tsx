import Link from "next/link"
import { redirect } from "next/navigation"

import { AcceptInvite } from "@/components/accept-invite"
import { Logo } from "@/components/logo"
import { getOpenInvite } from "@/lib/invites"
import { getSession } from "@/lib/session"

export default async function InvitePage({ params }: PageProps<"/invite/[id]">) {
  const { id } = await params
  const invite = await getOpenInvite(id)
  const session = await getSession()
  if (invite && !session) redirect(`/sign-up?invite=${invite.id}`)

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 p-4">
      <Logo className="text-4xl" />
      <div className="w-full max-w-sm rounded-[2rem] bg-card p-8 text-center shadow-sm">
        {!invite ? (
          <>
            <h1 className="text-xl font-medium">This invite has expired</h1>
            <p className="mt-2 text-sm text-muted-foreground">Ask for a new one.</p>
          </>
        ) : session!.user.email !== invite.email ? (
          <>
            <h1 className="text-xl font-medium">Wrong account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This invite is for {invite.email}, but you&apos;re signed in as {session!.user.email}.
            </p>
          </>
        ) : (
          <AcceptInvite id={invite.id} orgName={invite.orgName} />
        )}
        <Link href="/" className="mt-6 inline-block text-sm text-muted-foreground hover:text-foreground">
          Go to WeTrack
        </Link>
      </div>
    </main>
  )
}
