"use client"

import { BellRingIcon, ShareIcon } from "lucide-react"

import { BellIcon } from "@/components/animate-ui/icons/bell"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { markNotificationsRead, removePushSubscription, savePushSubscription } from "@/app/actions"
import { UserAvatar } from "@/components/bits"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import type { InboxPage } from "@/lib/queries"
import { cn, whenIdle } from "@/lib/utils"

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const canPush = () => !!VAPID_KEY && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window

// PushHost fetches the bell's data and hands it to every bell (rail and dock) with this event.
const INBOX_EVENT = "wetrack:inbox"
const POLL_MS = 30_000

async function fetchInbox(before?: string): Promise<InboxPage> {
  const res = await fetch(`/api/notifications${before ? `?before=${encodeURIComponent(before)}` : ""}`)
  if (!res.ok || !res.headers.get("content-type")?.includes("json")) throw new Error(`${res.status}`)
  return res.json()
}

// The round glass bell by search (rail and dock). Opening it marks everything seen; the dots stay until it closes.
export function Inbox({ initial, side }: { initial: InboxPage; side: "top" | "right" | "bottom" }) {
  const [open, setOpen] = useState(false)
  // The newest page: from the server render, then from every poll. A new server render (after an edit) wins.
  const [live, setLive] = useState(initial)
  const [prevInitial, setPrevInitial] = useState(initial)
  if (initial !== prevInitial) {
    setPrevInitial(initial)
    setLive(initial)
  }
  useEffect(() => {
    const onInbox = (e: Event) => setLive((e as CustomEvent<InboxPage>).detail)
    window.addEventListener(INBOX_EVENT, onInbox)
    return () => window.removeEventListener(INBOX_EVENT, onInbox)
  }, [])

  // Pages loaded with "Show older", kept under whatever the newest page is now.
  const [older, setOlder] = useState<InboxPage | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const ids = new Set(live.items.map((n) => n.id))
  const items = [...live.items, ...(older?.items.filter((n) => !ids.has(n.id)) ?? [])]
  const hasMore = older ? older.hasMore : live.hasMore

  async function showOlder() {
    setLoadingOlder(true)
    try {
      const next = await fetchInbox(items.at(-1)?.at)
      setOlder((o) => ({ ...next, items: [...(o?.items ?? []), ...next.items] }))
    } catch {
      toast.error("Couldn't load older notifications. Try again.")
    } finally {
      setLoadingOlder(false)
    }
  }

  // The data this person has opened. New data (a poll, a push, a refresh) has a new key and shows its own count.
  const key = `${live.items[0]?.id}:${live.unread}`
  const [seenKey, setSeenKey] = useState<string | null>(null)
  const count = seenKey === key ? 0 : live.unread
  const fresh = seenKey !== key || open

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next && count > 0) {
      setSeenKey(key)
      void markNotificationsRead()
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        aria-label={count ? `Notifications, ${count} new` : "Notifications"}
        className="relative grid size-8 place-items-center rounded-lg text-muted-foreground transition-[background-color,color,scale] hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 data-popup-open:bg-accent data-popup-open:text-foreground"
      >
        <BellIcon animateOnHover className="size-4" />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-foreground px-1 text-[11px] font-medium text-background tabular ring-2 ring-background">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="end"
        sideOffset={10}
        className="w-[min(22rem,calc(100vw-2rem))] gap-1 rounded-tile bg-card p-2 shadow-lg ring-foreground/5"
      >
        <h2 className="px-3 pt-2 pb-1 text-lg">Notifications</h2>
        {items.length === 0 ? (
          <p className="rounded-card bg-muted/60 px-5 py-6 text-sm text-muted-foreground">
            Nothing yet. You&apos;ll hear here when someone assigns you a task, comments on your work, invites you to a
            meeting or gives you feedback.
          </p>
        ) : (
          <ul className="-mx-1 max-h-[min(28rem,60dvh)] overflow-y-auto px-1">
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="flex gap-3 rounded-row px-3 py-2.5 outline-none transition-[background-color,scale] hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-99"
                >
                  {n.actor ? (
                    <UserAvatar user={n.actor} className="mt-0.5 size-8 shrink-0 ring-0" />
                  ) : (
                    <span className="mt-0.5 size-8 shrink-0 rounded-full bg-muted" />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                    <span className="text-muted-foreground">
                      <span className="text-foreground">{n.actor?.name ?? "Someone"}</span> {n.verb}
                    </span>
                    {n.subject && <span className="line-clamp-2 text-foreground">{n.subject}</span>}
                    {n.preview && <span className="line-clamp-2 text-muted-foreground">{n.preview}</span>}
                    <span className="text-xs text-muted-foreground">{n.ago}</span>
                  </span>
                  {n.unread && fresh && (
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-foreground">
                      <span className="sr-only">New</span>
                    </span>
                  )}
                </Link>
              </li>
            ))}
            {hasMore && (
              <li className="flex justify-center py-1">
                <button
                  type="button"
                  onClick={showOlder}
                  disabled={loadingOlder}
                  className="flex h-9 items-center gap-1.5 rounded-full px-4 text-sm text-muted-foreground transition-[color,background-color,scale] hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 disabled:opacity-70"
                >
                  {loadingOlder && <Spinner className="size-3.5" />}
                  {loadingOlder ? "Loading…" : "Show older"}
                </button>
              </li>
            )}
          </ul>
        )}
        <PushToggle />
      </PopoverContent>
    </Popover>
  )
}

type PushState = "unsupported" | "install" | "loading" | "off" | "on" | "denied"

// iPhone and iPad only offer push to WeTrack once it's on the Home Screen (app/manifest.ts).
const needsInstall = () =>
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) &&
  !matchMedia("(display-mode: standalone)").matches

// "Push notifications" at the foot of the inbox: asks the browser only when pressed.
function PushToggle() {
  // Only rendered in the open popover, so the browser APIs are there.
  const [state, setState] = useState<PushState>(() =>
    !canPush() ? (needsInstall() ? "install" : "unsupported") : Notification.permission === "denied" ? "denied" : "loading"
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!canPush() || Notification.permission === "denied") return
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"))
  }, [])

  async function toggle() {
    setBusy(true)
    try {
      if (state === "on") {
        await unsubscribe()
        setState("off")
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off")
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64Url(VAPID_KEY!) })
      const res = await savePushSubscription(sub.toJSON())
      if (res.error) {
        await sub.unsubscribe()
        throw new Error(res.error)
      }
      setState("on")
      toast.success("Push notifications on")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't turn on push notifications.")
    } finally {
      setBusy(false)
    }
  }

  if (state === "unsupported" || state === "loading") return null
  if (state === "install")
    return (
      <div className="mt-1 flex items-start gap-2 rounded-row bg-muted/60 px-3 py-2.5 text-sm">
        <ShareIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">
          <span className="text-foreground">Get push notifications on this phone.</span> Tap Share, then Add to Home
          Screen, and open WeTrack from there.
        </span>
      </div>
    )
  return (
    <div className="mt-1 flex min-h-11 items-center gap-2 rounded-row bg-muted/60 p-1 pl-3 text-sm">
      <BellRingIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1">Push notifications</span>
      {state === "denied" ? (
        <span className="pr-2 text-xs text-muted-foreground">Blocked in browser settings</span>
      ) : (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-full px-4 transition-[background-color,scale] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 disabled:opacity-70",
            state === "on" ? "bg-card hover:bg-background" : "bg-foreground text-background"
          )}
        >
          {busy && <Spinner className="size-3.5" />}
          {state === "on" ? "Turn off" : "Turn on"}
        </button>
      )}
    </div>
  )
}

/** Stop pushing to this browser (Turn off, and before signing out so the next person doesn't get them). */
export async function unsubscribe() {
  if (!canPush()) return
  const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription()
  if (!sub) return
  await removePushSubscription(sub.endpoint)
  await sub.unsubscribe()
}

function base64Url(s: string) {
  const raw = atob((s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

// Mounted once in the app layout. Keeps every bell current: it polls the inbox while the tab is visible (and
// at once when you come back to it or a push arrives), keeps the worker current, toasts a push for the tab
// you're on, and moves the router for banner clicks (no reload).
// ponytail: a 30s poll per open tab; move to server-sent events if that load ever shows up.
export function PushHost() {
  const router = useRouter()

  useEffect(() => {
    let newest: string | undefined
    const poll = () => {
      if (document.visibilityState !== "visible") return
      fetchInbox()
        .then((page) => {
          window.dispatchEvent(new CustomEvent(INBOX_EVENT, { detail: page }))
          // Something new for you: the page may show it too (a task now yours, a meeting on Home).
          if (newest !== undefined && page.items[0]?.id !== newest) router.refresh()
          newest = page.items[0]?.id ?? ""
        })
        .catch(() => {}) // offline or signed out: the next poll tries again
    }
    const timer = setInterval(poll, POLL_MS)
    document.addEventListener("visibilitychange", poll)
    window.addEventListener(INBOX_EVENT + ":poll", poll)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", poll)
      window.removeEventListener(INBOX_EVENT + ":poll", poll)
    }
  }, [router])

  useEffect(() => {
    if (!canPush()) return
    const cancel = whenIdle(() => {
      if (Notification.permission === "granted")
        navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {})
    })
    const onMessage = (e: MessageEvent<{ type: string; title?: string; body?: string; url: string }>) => {
      const path = new URL(e.data.url, location.origin).pathname
      if (e.data.type === "open") return router.push(path)
      if (e.data.type !== "notification") return
      window.dispatchEvent(new Event(INBOX_EVENT + ":poll"))
      if (document.visibilityState === "visible")
        toast(e.data.title, { description: e.data.body, action: { label: "Open", onClick: () => router.push(path) } })
    }
    navigator.serviceWorker.addEventListener("message", onMessage)
    navigator.serviceWorker.startMessages()
    return () => {
      cancel()
      navigator.serviceWorker.removeEventListener("message", onMessage)
    }
  }, [router])
  return null
}
