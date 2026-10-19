"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth-client"

type Props = { mode: "sign-in" | "sign-up"; email?: string; inviteId?: string }

export function AuthForm({ mode, email, inviteId }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const suffix = inviteId ? `?invite=${inviteId}` : ""

  async function onSubmit(form: FormData) {
    setPending(true)
    setError(null)
    const values = {
      email: String(email ?? form.get("email")),
      password: String(form.get("password")),
      name: String(form.get("name") ?? ""),
    }
    const res =
      mode === "sign-up"
        ? await authClient.signUp.email(values)
        : await authClient.signIn.email(values)
    if (res.error) {
      setPending(false)
      return setError(res.error.message ?? "Something went wrong.")
    }
    if (inviteId) {
      const accepted = await authClient.organization.acceptInvitation({ invitationId: inviteId })
      if (accepted.error) {
        setPending(false)
        return setError(accepted.error.message ?? "Could not accept the invite.")
      }
    }
    router.push("/")
    router.refresh()
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <h1 className="text-xl font-medium">{mode === "sign-up" ? "Create your account" : "Welcome back"}</h1>
      {mode === "sign-up" && (
        <div className="grid gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required autoComplete="name" className="h-10" />
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={email}
          disabled={!!email}
          className="h-10"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          className="h-10"
        />
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" size="lg" className="h-10" disabled={pending}>
        {pending ? "One moment…" : mode === "sign-up" ? "Create account" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {mode === "sign-up" ? (
          <>Already have an account? <Link className="text-foreground underline-offset-4 hover:underline" href={`/sign-in${suffix}`}>Sign in</Link></>
        ) : (
          <>New here? <Link className="text-foreground underline-offset-4 hover:underline" href={`/sign-up${suffix}`}>Create an account</Link></>
        )}
      </p>
    </form>
  )
}
