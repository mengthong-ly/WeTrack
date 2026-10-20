export { cn } from "cn"

// True when a key press is going into a field, so single-key shortcuts should ignore it.
export function isTyping(el: EventTarget | null) {
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
}
