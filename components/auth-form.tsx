"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth-client"

type Props = { mode: "sign-in" | "sign-up"; google: boolean }

export function AuthForm({ mode, google }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function onSubmit(form: FormData) {
    setPending(true)
    setError(null)
    const values = {
      email: String(form.get("email")),
      password: String(form.get("password")),
      name: String(form.get("name") ?? ""),
    }
    const res = mode === "sign-up" ? await authClient.signUp.email(values) : await authClient.signIn.email(values)
    if (res.error || mode === "sign-up") setPending(false)
    // Unconfirmed accounts can't sign in; Better Auth has just emailed them a fresh link.
    if (res.error?.status === 403) return setError("Confirm your email first. We just sent you a new link.")
    if (res.error) return setError(res.error.message ?? "Something went wrong.")
    if (mode === "sign-up") return setSentTo(values.email)
    // Home sends anyone without a workspace on to /onboarding.
    router.push("/")
    router.refresh()
  }

  async function withGoogle() {
    setPending(true)
    setError(null)
    const res = await authClient.signIn.social({ provider: "google", callbackURL: "/" })
    if (res.error) {
      setPending(false)
      setError(res.error.message ?? "Could not reach Google.")
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-medium">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a link to {sentTo}. Open it to confirm your email and sign in.
        </p>
      </div>
    )
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <h1 className="text-xl font-medium">{mode === "sign-up" ? "Create your account" : "Welcome back"}</h1>
      {google && (
        <>
          <Button variant="outline" size="lg" className="h-10" disabled={pending} onClick={withGoogle}>
            <GoogleIcon />
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-foreground/10" />
            or with email
            <span className="h-px flex-1 bg-foreground/10" />
          </div>
        </>
      )}
      {mode === "sign-up" && (
        <div className="grid gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required autoComplete="name" className="h-10" />
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" className="h-10" />
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
          <>Already have an account? <Link className="text-foreground underline-offset-4 hover:underline" href="/sign-in">Sign in</Link></>
        ) : (
          <>New here? <Link className="text-foreground underline-offset-4 hover:underline" href="/sign-up">Create an account</Link></>
        )}
      </p>
    </form>
  )
}

// Google's mark keeps its own colours (brand asset, not a theme colour).
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  )
}
