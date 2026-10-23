"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import { createJoinCode, turnOffJoinCode } from "@/app/actions"
import { CopyButton } from "@/components/share-link-card"
import { Button } from "@/components/ui/button"

// Team, owners and admins: the code a new teammate types on /onboarding after signing up.
export function JoinCodeCard({ active }: { active: { code: string; expires: string } | null }) {
  const [pending, start] = useTransition()

  const generate = () =>
    start(async () => {
      if (active && !confirm("Make a new code? The current code will stop working.")) return
      const res = await createJoinCode()
      if (res.error) toast.error(res.error)
    })

  const turnOff = () =>
    start(async () => {
      if (!confirm("Turn off the code? Nobody new can join until you make another.")) return
      const res = await turnOffJoinCode()
      if (res.error) toast.error(res.error)
      else toast.success("Code turned off")
    })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Teammates sign up, pick Join a team and type this code. They join as members; the owner can make them admins.
      </p>
      {active && (
        <div className="flex flex-col gap-3 rounded-panel bg-muted/70 p-3 sm:flex-row sm:items-center">
          <output
            aria-label="Join code"
            className="flex h-12 flex-1 items-center justify-center rounded-full bg-card px-4 font-mono text-xl tracking-widest select-all"
          >
            {active.code}
          </output>
          <CopyButton text={active.code} label="Copy code" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" className="h-10 rounded-full px-5" disabled={pending} onClick={generate}>
          {active ? "Make a new code" : "Create code"}
        </Button>
        {active && (
          <Button type="button" variant="ghost" className="h-10 rounded-full" disabled={pending} onClick={turnOff}>
            Turn off
          </Button>
        )}
        {active && <span className="text-sm text-muted-foreground">Expires {active.expires}</span>}
      </div>
    </div>
  )
}
