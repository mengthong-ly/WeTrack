"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { motion, useAnimate, useReducedMotion } from "motion/react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

// Seconds before "Resend code" works again (the plugin allows 3 codes a minute per address).
const RESEND_WAIT = 30

// The auth pages sit on the grey canvas, not in a card, so their controls are white pills.
export const authField = "h-11 rounded-full border-transparent bg-card px-4 shadow-sm dark:bg-card"
export const authButton = "h-11 rounded-full px-5 transition-[background-color,scale] active:scale-97"
const linkButton = "h-auto p-0 text-muted-foreground disabled:opacity-100"

// Email, then the 6-digit code we send to it. The first sign-in creates the account, so there's
// no separate sign-up.
export function AuthForm({ google }: { google: boolean }) {
  const router = useRouter()
  const reduce = useReducedMotion()
  const [slots, animate] = useAnimate<HTMLDivElement>()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  // Which way the last step change went (1 on to the code, -1 back to the email), so the new step slides in from that
  // side. 0 until the first change: the page's own entrance covers the first step.
  const [dir, setDir] = useState(0)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<"google" | "send" | "verify" | null>(null)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (!wait) return
    const id = setTimeout(() => setWait(wait - 1), 1000)
    return () => clearTimeout(id)
  }, [wait])

  // Coming back from Google's page restores this one from the back/forward cache, still pending.
  useEffect(() => {
    const reset = () => setPending(null)
    window.addEventListener("pageshow", reset)
    return () => window.removeEventListener("pageshow", reset)
  }, [])

  async function send() {
    setPending("send")
    setError(null)
    const res = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" })
    setPending(null)
    if (res.error) {
      const message = res.error.status === 429 ? "Too many codes. Wait a minute and try again." : (res.error.message ?? "Something went wrong.")
      // The code step's error line is about the code; a failed resend says so in a toast.
      if (sent) toast.error(message)
      else setError(message)
      return
    }
    if (sent) toast.success("New code sent")
    else setDir(1)
    setSent(true)
    setCode("")
    setWait(RESEND_WAIT)
  }

  async function verify(otp = code) {
    if (otp.length !== 6) return
    setPending("verify")
    setError(null)
    // name only applies to a new account; they can change it later.
    const res = await authClient.signIn.emailOtp({ email, otp, name: email.split("@")[0] })
    if (res.error) {
      setPending(null)
      setCode("")
      // A spent code can't be retried, so a new one can be sent at once.
      if (res.error.code === "OTP_EXPIRED" || res.error.code === "TOO_MANY_ATTEMPTS") setWait(0)
      setError(
        res.error.code === "OTP_EXPIRED" ? "That code has expired. Send a new one."
        : res.error.code === "TOO_MANY_ATTEMPTS" ? "Too many tries. Send a new code."
        : res.error.code === "INVALID_OTP" ? "That code didn't work. Check it and try again."
        : (res.error.message ?? "Something went wrong."),
      )
      // A short shake says "wrong" before the line is read. Reduced motion keeps the red ring and the line.
      if (!reduce) animate(slots.current, { x: [0, -8, 7, -5, 3, 0] }, { duration: 0.35, ease: "easeOut" })
      return
    }
    // Home sends anyone without a workspace on to /onboarding. pending stays set until the next page shows.
    router.push("/")
    router.refresh()
  }

  async function withGoogle() {
    setPending("google")
    setError(null)
    const res = await authClient.signIn.social({ provider: "google", callbackURL: "/" })
    if (res.error) {
      setPending(null)
      setError(res.error.message ?? "Could not reach Google.")
    }
  }

  // The button that's working stays solid with its spinner; only the others dim.
  const busy = (what: typeof pending) => pending === what && "disabled:opacity-100"

  const errorLine = (className?: string) =>
    error && (
      <p key={error} className={cn("animate-in text-sm text-destructive fade-in-0 duration-200", className)} role="alert">
        {error}
      </p>
    )

  return (
    <motion.div
      key={sent ? "code" : "email"}
      initial={dir ? { opacity: 0, x: reduce ? 0 : dir * 24 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {sent ? (
        <form
          // onSubmit, not action: a form action runs in a transition, which holds back the pending state until it ends.
          onSubmit={(e) => {
            e.preventDefault()
            verify()
          }}
          className="flex flex-col gap-8"
        >
          <AuthHeading title="Check your email">
            We sent a 6-digit code to <span className="wrap-anywhere text-foreground">{email}</span>. It expires in 5 minutes.
          </AuthHeading>
          <div className="flex flex-col gap-4">
            <div ref={slots}>
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
                readOnly={pending === "verify"}
                containerClassName="justify-center"
              >
                <InputOTPGroup className="gap-2 has-aria-invalid:ring-0">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      aria-invalid={!!error}
                      className="tabular size-12 rounded-row border border-transparent bg-card text-lg shadow-sm first:rounded-l-row last:rounded-r-row dark:bg-card"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            {errorLine("text-center")}
            <Button type="submit" size="lg" className={cn(authButton, busy("verify"))} disabled={!!pending || code.length !== 6}>
              {pending === "verify" && <Spinner aria-hidden />}
              {pending === "verify" ? "Signing in…" : "Sign in"}
            </Button>
            <div className="flex justify-between gap-2 text-sm">
              <Button
                variant="link"
                className={linkButton}
                onClick={() => {
                  setDir(-1)
                  setSent(false)
                  setError(null)
                }}
              >
                Use another email
              </Button>
              <Button variant="link" className={cn(linkButton, "tabular")} disabled={!!pending || wait > 0} onClick={send}>
                {pending === "send" ? "Sending…" : wait ? `Resend in ${wait}s` : "Resend code"}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="flex flex-col gap-8"
        >
          <AuthHeading title="Welcome to WeTrack">Sign in or create an account with your email.</AuthHeading>
          <div className="flex flex-col gap-4">
            {google && (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  className={cn(authButton, "border-transparent bg-card shadow-sm hover:bg-card/70 dark:border-transparent dark:bg-card dark:hover:bg-card/70", busy("google"))}
                  disabled={!!pending}
                  onClick={withGoogle}
                >
                  {pending === "google" ? <Spinner aria-hidden /> : <GoogleIcon />}
                  Continue with Google
                </Button>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-foreground/10" />
                  or with email
                  <span className="h-px flex-1 bg-foreground/10" />
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email" className="pl-4 font-normal text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                required
                maxLength={254}
                autoComplete="email"
                autoFocus
                placeholder="you@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value.trim())
                  setError(null)
                }}
                className={authField}
              />
            </div>
            {errorLine("pl-4")}
            <Button type="submit" size="lg" className={cn(authButton, busy("send"))} disabled={!!pending}>
              {pending === "send" && <Spinner aria-hidden />}
              {pending === "send" ? "Sending code…" : "Send code"}
            </Button>
          </div>
        </form>
      )}
    </motion.div>
  )
}

export function AuthHeading({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-light tracking-tight text-balance">{title}</h1>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">{children}</p>
    </div>
  )
}

// The round glass button at the top right of the auth pages; D does the same anywhere (ThemeHotkey). The icon for the
// theme you're in shows by CSS, so it's right before hydration, and its entrance replays as the theme flips.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const icon = "size-5 animate-in fade-in-0 zoom-in-75 spin-in-45 duration-300 ease-out-expo motion-reduce:zoom-in-100 motion-reduce:spin-in-0"
  return (
    <Tooltip>
      <TooltipTrigger
        delay={400}
        render={
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Switch theme"
            className="grid size-11 place-items-center rounded-full bg-card/70 text-muted-foreground ring-1 ring-foreground/5 backdrop-blur transition-[background-color,color,scale] hover:bg-card hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95"
          />
        }
      >
        <SunIcon className={cn(icon, "dark:hidden")} />
        <MoonIcon className={cn(icon, "hidden dark:block")} />
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" sideOffset={10} className="rounded-full py-1.5 pr-1.5 pl-3">
        Theme
        <kbd data-slot="kbd" className="grid h-5 min-w-5 place-items-center bg-background/15 px-1 font-sans text-[11px]">
          D
        </kbd>
      </TooltipContent>
    </Tooltip>
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
