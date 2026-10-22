"use client"

import { CalendarPlusIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { CALENDAR_SCOPE } from "@/lib/meetings"

// Links Google to the signed-in user with the calendar scope, then Google sends them back here.
// Offline access + consent (only here, not on plain sign-in) makes Google return a refresh token.
export async function connectGoogle() {
  const res = await authClient.linkSocial({
    provider: "google",
    scopes: [CALENDAR_SCOPE],
    callbackURL: location.pathname,
    additionalParams: { access_type: "offline", prompt: "consent" },
  })
  if (res.error) toast.error(res.error.message ?? "Couldn't reach Google. Try again.")
  return !res.error
}

export function ConnectGoogle({ className }: { className?: string }) {
  const [pending, setPending] = useState(false)
  return (
    <Button
      variant="outline"
      className={className}
      disabled={pending}
      onClick={async () => {
        setPending(true)
        // On success the page leaves for Google, so only a failure re-enables the button.
        if (!(await connectGoogle())) setPending(false)
      }}
    >
      <CalendarPlusIcon />
      Connect Google Calendar
    </Button>
  )
}
