"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { cancelInvite, inviteMember } from "@/app/actions"
import { Pick } from "@/components/pick"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function InviteForm() {
  const [role, setRole] = useState<"member" | "admin">("member")
  const [pending, start] = useTransition()
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      action={(form) =>
        start(async () => {
          const email = String(form.get("email") ?? "")
          const res = await inviteMember(email, role)
          if (res.error) toast.error(res.error)
          else toast.success(`Invite sent to ${email}`)
        })
      }
    >
      <Input name="email" type="email" required placeholder="teammate@company.com" aria-label="Email" className="h-10 flex-1 rounded-full px-4" />
      <Pick
        aria-label="Role"
        value={role}
        onChange={(v) => setRole(v as "member" | "admin")}
        options={[
          { value: "member", label: "Member" },
          { value: "admin", label: "Admin" },
        ]}
        className="h-10"
      />
      <Button type="submit" size="lg" className="h-10 rounded-full px-5" disabled={pending}>
        {pending ? "Sending…" : "Send invite"}
      </Button>
    </form>
  )
}

export function CancelInvite({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <Button
      variant="ghost"
      size="sm"
      className="rounded-full"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await cancelInvite(id)
          if (res.error) toast.error(res.error)
        })
      }
    >
      Cancel
    </Button>
  )
}
