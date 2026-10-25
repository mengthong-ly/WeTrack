"use client"

import { motion } from "motion/react"
import { useState, useTransition } from "react"

import { createWorkspace, joinWithCode } from "@/app/actions"
import { AuthHeading, authButton, authField } from "@/components/auth-form"
import { PillTabs } from "@/components/pill-tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"
import { formatJoinCode } from "@/lib/join-code"
import { cn } from "@/lib/utils"

// Signed in, not in a team yet: the only two ways forward.
export function GetStarted({ email }: { email: string }) {
  const [tab, setTab] = useState<"join" | "create">("join")
  return (
    <div className="flex flex-col gap-8">
      <AuthHeading title="Get started">Join your team with its code, or start a new one.</AuthHeading>
      <PillTabs
        id="get-started"
        className="grid grid-cols-2"
        items={[
          { key: "join", label: "Join a team", active: tab === "join", onSelect: () => setTab("join") },
          { key: "create", label: "Create a team", active: tab === "create", onSelect: () => setTab("create") },
        ]}
      />
      <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
        {tab === "join" ? <JoinForm /> : <CreateForm />}
      </motion.div>
      <p className="text-center text-xs text-muted-foreground">
        Signed in as {email}.{" "}
        <button
          type="button"
          className="text-foreground underline-offset-4 hover:underline"
          onClick={async () => {
            await authClient.signOut()
            // A full load, not router.push: Next keeps recent pages alive (hidden) in memory, and
            // the next person to sign in on this tab mustn't find the last one's pages there.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- the full load is the point
            window.location.href = "/sign-in"
          }}
        >
          Sign out
        </button>
      </p>
    </div>
  )
}

// Uppercase in dashed groups of four, the way the owner sees it on Team.
const shapeCode = (v: string) => formatJoinCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))

function JoinForm() {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string>()
  const [pending, start] = useTransition()
  return (
    <form
      className="flex flex-col gap-3"
      action={() => start(async () => setError((await joinWithCode(code)).error))}
    >
      <Input
        aria-label="Join code"
        placeholder="ABCD-2345-WXYZ"
        value={code}
        onChange={(e) => setCode(shapeCode(e.target.value))}
        required
        autoFocus
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        aria-invalid={!!error}
        className={cn(authField, "h-12 text-center font-mono text-lg tracking-widest md:text-lg")}
      />
      <p className="pl-4 text-xs text-muted-foreground">Ask your team&apos;s owner or an admin for it.</p>
      {error && <p className="pl-4 text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" size="lg" className={authButton} disabled={pending}>
        {pending && <Spinner aria-hidden />}
        {pending ? "Joining…" : "Join team"}
      </Button>
    </form>
  )
}

function CreateForm() {
  const [error, setError] = useState<string>()
  const [pending, start] = useTransition()
  return (
    <form
      className="flex flex-col gap-3"
      action={(form) => start(async () => setError((await createWorkspace(String(form.get("name")))).error))}
    >
      <Input name="name" aria-label="Team name" placeholder="WeShop" required minLength={2} autoFocus className={cn(authField, "h-12")} />
      <p className="pl-4 text-xs text-muted-foreground">Usually your team or company. You&apos;ll be its owner.</p>
      {error && <p className="pl-4 text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" size="lg" className={authButton} disabled={pending}>
        {pending && <Spinner aria-hidden />}
        {pending ? "Creating…" : "Create team"}
      </Button>
    </form>
  )
}
