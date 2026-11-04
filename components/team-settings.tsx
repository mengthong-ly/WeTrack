"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { leaveTeam, renameTeam } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// Team name (owners and admins rename it) and Leave team (everyone but the owner). The owner's own way out is not here yet.
export function TeamSettings({ name, canRename, canLeave }: { name: string; canRename: boolean; canLeave: boolean }) {
  const [error, setError] = useState<string>()
  const [pending, start] = useTransition()

  const save = (form: FormData) =>
    start(async () => {
      const res = await renameTeam(String(form.get("name") ?? ""))
      setError(res.error)
      if (!res.error) toast.success("Team renamed")
    })

  const leave = () =>
    start(async () => {
      if (!confirm(`Leave ${name}? You lose access right away. Your tasks stay as they are.`)) return
      const res = await leaveTeam()
      if (res?.error) toast.error(res.error)
    })

  return (
    <div className="flex flex-col gap-4">
      {canRename && (
        <form action={save} className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              name="name"
              defaultValue={name}
              required
              minLength={2}
              maxLength={60}
              aria-label="Team name"
              aria-invalid={!!error}
              className="h-10 flex-1 rounded-full px-4"
            />
            <Button type="submit" className="h-10 rounded-full px-5" disabled={pending}>
              {pending ? "Saving…" : "Rename"}
            </Button>
          </div>
          {error && (
            <p role="alert" className="pl-4 text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      )}
      {canLeave && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Leave this team. You can join again with a join code.</p>
          <Button variant="outline" className="h-10 rounded-full px-5 text-destructive" disabled={pending} onClick={leave}>
            Leave team
          </Button>
        </div>
      )}
    </div>
  )
}
