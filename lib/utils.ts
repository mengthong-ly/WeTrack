export { cn } from "cn"

// Where a stored image (lib/storage.ts) is served, to members of its workspace only.
export const attachmentSrc = (id: string) => `/api/attachments/${id}`

// True when a key press is going into a field, so single-key shortcuts should ignore it.
export function isTyping(el: EventTarget | null) {
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
}

// Runs `fn` when the browser is idle (Safari has no requestIdleCallback: a short timeout instead).
// Returns a cancel function, for an effect's cleanup.
export function whenIdle(fn: () => void) {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(fn)
    return () => cancelIdleCallback(id)
  }
  const id = setTimeout(fn, 200)
  return () => clearTimeout(id)
}
