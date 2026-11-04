// WeTrack's service worker: push notifications only, no caching.
// The page registers it from components/inbox.tsx; a push arrives as { title, body, url } from lib/notify.ts.

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : null
  if (!data) return
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      // Open tabs refresh their inbox; a tab you're looking at shows a toast instead of a system banner.
      for (const w of windows) w.postMessage({ type: "notification", ...data })
      if (windows.some((w) => w.visibilityState === "visible" && w.focused)) return
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/icons/icon-192.png",
        tag: data.url, // a second change to the same task replaces the first banner
        renotify: true,
        data: { url: data.url },
      })
    })()
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url ?? "/", self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      const tab = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (tab) {
        // The page moves itself with the router, so it doesn't reload.
        tab.postMessage({ type: "open", url })
        return tab.focus()
      }
      return self.clients.openWindow(url)
    })()
  )
})
