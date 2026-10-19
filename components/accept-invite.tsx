"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

export function AcceptInvite({ id, orgName }: { id: string; orgName: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <>
      <h1 className="text-xl font-medium">Join {orgName}</h1>
      <Button
        size="lg"
        className="mt-6 h-10 w-full"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          const res = await authClient.organization.acceptInvitation({ invitationId: id })
          if (res.error) {
            setPending(false)
            return toast.error(res.error.message ?? "Could not join.")
          }
          router.push("/")
          router.refresh()
        }}
      >
        {pending ? "Joining…" : "Accept invite"}
      </Button>
    </>
  )
}
