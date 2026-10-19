"use client"

import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { createShareLink, revokeShareLink } from "@/app/actions"
import { Button } from "@/components/ui/button"

export function CopyButton({
  text,
  label = "Copy",
}: {
  text: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="secondary"
      className="h-10 rounded-full px-4"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          toast.error("Couldn't copy. Select the text and copy it manually.")
        }
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? "Copied" : label}
    </Button>
  )
}

export function ShareLinkCard({
  active,
}: {
  active: { createdAt: string; lastViewed: string | null } | null
}) {
  const [url, setUrl] = useState<string>()
  const [pending, start] = useTransition()

  const generate = () =>
    start(async () => {
      if (
        active &&
        !confirm("Make a new link? The current link will stop working.")
      )
        return
      const res = await createShareLink()
      if (res.error || !res.token) {
        toast.error(res.error ?? "Couldn't create the link.")
        return
      }
      setUrl(`${window.location.origin}/r/${res.token}`)
    })

  const revoke = () =>
    start(async () => {
      if (!confirm("Turn off the link? Anyone using it loses access.")) return
      const res = await revokeShareLink()
      if (res.error) toast.error(res.error)
      else {
        setUrl(undefined)
        toast.success("Link turned off")
      }
    })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        A read-only dashboard for your CEO: no account, no editing. Anyone with
        the link can view it.
      </p>
      <AnimatePresence initial={false}>
        {url && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2 rounded-panel bg-muted/70 p-3 sm:flex-row sm:items-center">
              <input
                readOnly
                value={url}
                aria-label="Share link"
                onFocus={(e) => e.currentTarget.select()}
                className="h-10 min-w-0 flex-1 rounded-full bg-card px-4 font-mono text-xs outline-none"
              />
              <div className="flex gap-2">
                <CopyButton text={url} label="Copy link" />
                <Button
                  variant="ghost"
                  className="h-10 rounded-full"
                  nativeButton={false}
                  render={<a href={url} target="_blank" rel="noreferrer" />}
                >
                  <ExternalLinkIcon />
                  Open
                </Button>
              </div>
            </div>
            <p className="mt-2 px-1 text-xs text-muted-foreground">
              Copy it now. For safety WeTrack only keeps a fingerprint of the
              link, so it can&apos;t show it again.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="h-10 rounded-full px-5"
          disabled={pending}
          onClick={generate}
        >
          {active ? "Make a new link" : "Create link"}
        </Button>
        {active && (
          <Button
            type="button"
            variant="ghost"
            className="h-10 rounded-full"
            disabled={pending}
            onClick={revoke}
          >
            Turn off
          </Button>
        )}
        {active && (
          <span className="text-sm text-muted-foreground">
            Active since {active.createdAt}
            {active.lastViewed
              ? ` · last viewed ${active.lastViewed}`
              : " · not viewed yet"}
          </span>
        )}
      </div>
    </div>
  )
}
