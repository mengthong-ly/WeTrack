"use client"

import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { createWorkspace, joinWithCode } from "@/app/actions"
import { PillTabs } from "@/components/pill-tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { formatJoinCode } from "@/lib/join-code"

// Signed in, not in a team yet: the only two ways forward.
export function GetStarted({ email }: { email: string }) {
  const router = useRouter()
  const [tab, setTab] = useState<"join" | "create">("join")
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-medium">Get started</h1>
        <p className="mt-1 text-sm text-muted-foreground">Join your team with its code, or start a new one.</p>
      </div>
      <PillTabs
        id="get-started"
        className="grid grid-cols-2 bg-muted ring-0"
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
            router.push("/sign-in")
            router.refresh()
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
        className="h-12 text-center font-mono text-lg tracking-widest md:text-lg"
      />
      <p className="text-xs text-muted-foreground">Ask your team&apos;s owner or an admin for it.</p>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" size="lg" className="h-10" disabled={pending}>
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
      <Input name="name" aria-label="Team name" placeholder="WeShop" required minLength={2} autoFocus className="h-12" />
      <p className="text-xs text-muted-foreground">Usually your team or company. You&apos;ll be its owner.</p>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" size="lg" className="h-10" disabled={pending}>
        {pending ? "Creating…" : "Create team"}
      </Button>
    </form>
  )
}
