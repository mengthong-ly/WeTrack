"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { setSlackWebhook } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function SlackCard({ connected }: { connected: boolean }) {
  const [replacing, setReplacing] = useState(false)
  const [error, setError] = useState<string>()
  const [pending, start] = useTransition()
  const showForm = !connected || replacing

  const save = (form: FormData) =>
    start(async () => {
      const res = await setSlackWebhook(String(form.get("url") ?? ""))
      if (res.error) {
        setError(res.error)
        return
      }
      setError(undefined)
      setReplacing(false)
      toast.success("Slack connected")
    })

  const remove = () =>
    start(async () => {
      if (!confirm("Stop posting to Slack? Meeting links and reminders will no longer appear there.")) return
      const res = await setSlackWebhook(null)
      if (res.error) toast.error(res.error)
      else toast.success("Slack disconnected")
    })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {connected
          ? "New meetings and one-hour reminders appear in the channel."
          : "Post new meetings and one-hour reminders to a Slack channel. Paste an incoming webhook URL."}
      </p>
      {showForm ? (
        <form action={save} className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              name="url"
              type="url"
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="https://hooks.slack.com/services/…"
              aria-label="Slack webhook URL"
              aria-invalid={!!error}
              className="h-10 flex-1 rounded-full px-4"
            />
            <div className="flex gap-2">
              <Button type="submit" className="h-10 rounded-full px-5" disabled={pending}>
                {pending ? "Checking…" : connected ? "Replace" : "Connect"}
              </Button>
              {replacing && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 rounded-full"
                  disabled={pending}
                  onClick={() => {
                    setReplacing(false)
                    setError(undefined)
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
          {error && (
            <p role="alert" className="px-1 text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">Posting to Slack</span>
          <Button type="button" variant="secondary" className="h-10 rounded-full px-4" disabled={pending} onClick={() => setReplacing(true)}>
            Replace
          </Button>
          <Button type="button" variant="ghost" className="h-10 rounded-full" disabled={pending} onClick={remove}>
            Remove
          </Button>
        </div>
      )}
    </div>
  )
}
