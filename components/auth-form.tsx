"use client"

import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth-client"

// Email, then the 6-digit code we send to it. The first sign-in creates the account, so there's
// no separate sign-up.
export function AuthForm({ google }: { google: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function send() {
    setPending(true)
    setError(null)
    const res = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" })
    setPending(false)
    if (res.error) return setError(res.error.status === 429 ? "Too many codes. Wait a minute and try again." : (res.error.message ?? "Something went wrong."))
    if (sent) toast.success("New code sent")
    setSent(true)
    setCode("")
  }

  async function verify(otp = code) {
    if (otp.length !== 6) return
    setPending(true)
    setError(null)
    // name only applies to a new account; they can change it later.
    const res = await authClient.signIn.emailOtp({ email, otp, name: email.split("@")[0] })
    if (res.error) {
      setPending(false)
      setCode("")
      return setError(
        res.error.code === "OTP_EXPIRED" ? "That code has expired. Send a new one."
        : res.error.code === "TOO_MANY_ATTEMPTS" ? "Too many tries. Send a new code."
        : res.error.code === "INVALID_OTP" ? "That code didn't work. Check it and try again."
        : (res.error.message ?? "Something went wrong."),
      )
    }
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

  const errorLine = error && <p className="text-sm text-destructive" role="alert">{error}</p>

  return (
    <motion.div key={sent ? "code" : "email"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      {sent ? (
        <form action={() => verify()} className="flex flex-col gap-4">
          <div>
            <h1 className="text-xl font-medium">Check your email</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              We sent a 6-digit code to <span className="wrap-anywhere text-foreground">{email}</span>.
            </p>
          </div>
          <InputOTP
            maxLength={6}
            pattern="^\d+$"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            aria-label="Sign-in code"
            value={code}
            onChange={(v) => {
              setCode(v)
              setError(null)
            }}
            onComplete={verify}
            // readOnly, not disabled: a disabled field drops focus, and a wrong code is retyped at once.
            readOnly={pending}
            containerClassName="justify-center"
          >
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} aria-invalid={!!error} className="tabular size-12 text-lg" />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {errorLine}
          <Button type="submit" size="lg" className="h-10" disabled={pending || code.length !== 6}>
            {pending ? "One moment…" : "Sign in"}
          </Button>
          <div className="flex justify-between gap-2 text-sm">
            <Button
              variant="link"
              className="h-auto p-0 text-muted-foreground"
              onClick={() => {
                setSent(false)
                setError(null)
              }}
            >
              Use another email
            </Button>
            <Button variant="link" className="h-auto p-0 text-muted-foreground" disabled={pending} onClick={send}>
              Resend code
            </Button>
          </div>
        </form>
      ) : (
        <form action={send} className="flex flex-col gap-4">
          <div>
            <h1 className="text-xl font-medium">Welcome to WeTrack</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in or create an account with your email.</p>
          </div>
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
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              required
              maxLength={254}
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              className="h-10"
            />
          </div>
          {errorLine}
          <Button type="submit" size="lg" className="h-10" disabled={pending}>
            {pending ? "Sending…" : "Send code"}
          </Button>
        </form>
      )}
    </motion.div>
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
