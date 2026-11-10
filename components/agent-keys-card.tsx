"use client"

import { KeyRoundIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { createAgentKey, revokeAgentKey } from "@/app/actions"
import { spring } from "@/components/motion-bits"
import { CopyButton } from "@/components/share-link-card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type AgentKeyRow = { id: string; name: string; created: string; lastUsed: string | null; expires: string }

// Your own API keys (Team page, every member). The plain key exists only in this component's state, once.
export function AgentKeysCard({ keys, limit, days }: { keys: AgentKeyRow[]; limit: number; days: number }) {
  const reduce = useReducedMotion()
  const [made, setMade] = useState<{ key: string; snippet: string }>()
  const [error, setError] = useState<string>()
  // The row being revoked stays set while the dialog animates out, so its title doesn't blank.
  const [target, setTarget] = useState<AgentKeyRow>()
  const [confirming, setConfirming] = useState(false)
  const [creating, startCreate] = useTransition()
  const [revoking, startRevoke] = useTransition()
  const atLimit = keys.length >= limit
  // A new key takes focus (its input selects itself), so the 5th key's form unmounting never drops focus to <body>.
  const keyInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (made) keyInput.current?.focus()
  }, [made])

  const create = (form: HTMLFormElement) =>
    startCreate(async () => {
      const res = await createAgentKey(String(new FormData(form).get("name") ?? ""))
      if (res.error || !res.key) {
        setError(res.error ?? "Couldn't create the key.")
        return
      }
      setError(undefined)
      form.reset()
      const origin = window.location.origin
      setMade({
        key: res.key,
        snippet: [
          `export WETRACK_URL=${origin}`,
          `export WETRACK_API_KEY=${res.key}`,
          `claude mcp add --transport http wetrack ${origin}/api/mcp --header "Authorization: Bearer ${res.key}"`,
        ].join("\n"),
      })
    })

  const revoke = () =>
    startRevoke(async () => {
      if (!target) return
      const res = await revokeAgentKey(target.id)
      setConfirming(false)
      if (res.error) toast.error(res.error)
      else toast.success("Key revoked")
    })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        A personal key reads and updates your work in this team, as you. Use it from Claude Code or any script. Keys
        last {days} days.
      </p>

      {/* Mounted before the key appears, so screen readers announce the change. */}
      <p role="status" className="sr-only">
        {made ? "Key created. Copy it now, it won't be shown again." : ""}
      </p>

      <AnimatePresence initial={false}>
        {made && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 rounded-panel bg-muted/70 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  ref={keyInput}
                  readOnly
                  value={made.key}
                  aria-label="New API key"
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-10 flex-1 rounded-full bg-card px-4 font-mono text-xs md:text-xs"
                />
                <CopyButton text={made.key} label="Copy key" />
              </div>
              <p className="px-1 text-sm">Copy it now. It won&apos;t be shown again.</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <pre
                  tabIndex={0}
                  aria-label="Setup commands"
                  className="min-w-0 flex-1 overflow-x-auto rounded-row bg-card px-4 py-3 font-mono text-xs leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {made.snippet}
                </pre>
                <div className="flex gap-2">
                  <CopyButton text={made.snippet} label="Copy setup" />
                  <Button type="button" variant="ghost" className="h-10 rounded-full" onClick={() => setMade(undefined)}>
                    Done
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {atLimit ? (
        <p className="text-sm text-muted-foreground">
          You have {limit} live keys, the most you can have. Revoke one to make another.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            create(e.currentTarget)
          }}
          className="flex flex-col gap-2"
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              name="name"
              required
              maxLength={60}
              autoComplete="off"
              placeholder="Name it, e.g. Work laptop"
              aria-label="Key name"
              aria-invalid={!!error}
              onChange={() => error && setError(undefined)}
              className="h-10 flex-1 rounded-full px-4"
            />
            <Button type="submit" className="h-10 rounded-full px-5" disabled={creating}>
              {creating ? "Creating…" : "Create key"}
            </Button>
          </div>
          {error && (
            <p role="alert" className="px-1 text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      )}

      {keys.length ? (
        <ul className="relative flex flex-col gap-1.5">
          <AnimatePresence mode="popLayout" initial={false}>
            {keys.map((k) => (
              <motion.li
                key={k.id}
                layout={!reduce}
                initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: reduce ? 1 : 0.97, transition: { duration: 0.2 } }}
                transition={spring}
                className="flex items-center gap-3 rounded-row bg-muted/60 py-2 pr-2 pl-4"
              >
                <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{k.name}</p>
                  <p className="text-xs text-muted-foreground tabular">
                    Created {k.created} · {k.lastUsed ? `Last used ${k.lastUsed}` : "Not used yet"} · Expires{" "}
                    {k.expires}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 shrink-0 rounded-full active:scale-95"
                  disabled={revoking}
                  onClick={() => {
                    setTarget(k)
                    setConfirming(true)
                  }}
                >
                  Revoke
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="rounded-card bg-muted/60 px-5 py-6 text-sm text-muted-foreground">
          No keys yet. Name one above and create it to connect Claude Code or a script.
        </p>
      )}

      <AlertDialog open={confirming} onOpenChange={(open) => !revoking && setConfirming(open)}>
        <AlertDialogContent className="rounded-tile bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-normal">Revoke {target?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Anything using this key stops working at once. You can&apos;t undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="rounded-b-tile">
            <AlertDialogCancel className="h-10 rounded-full px-4" disabled={revoking}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" className="h-10 rounded-full px-4" disabled={revoking} onClick={revoke}>
              {revoking ? "Revoking…" : "Revoke key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
