"use client"

import { useState, useTransition } from "react"

import { createWorkspace } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function WorkspaceForm() {
  const [error, setError] = useState<string>()
  const [pending, start] = useTransition()
  return (
    <form
      className="mt-6 flex flex-col gap-3"
      action={(form) =>
        start(async () => setError((await createWorkspace(String(form.get("name")))).error))
      }
    >
      <Input name="name" aria-label="Workspace name" placeholder="WeShop" required minLength={2} className="h-10" autoFocus />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="h-10" disabled={pending}>
        {pending ? "Creating…" : "Create workspace"}
      </Button>
    </form>
  )
}
