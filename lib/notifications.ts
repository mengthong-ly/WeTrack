// What a notification says and where it goes, shared by the inbox and push. No app imports, so node --test can load it.
import type { TaskStatus } from "./db/enums.ts"
import { STATUS } from "./labels.ts"

export type NotificationKind =
  | "assigned"
  | "commented"
  | "status_changed"
  | "completed"
  | "deadline_changed"
  | "feedback"
  | "meeting_invited"
  | "meeting_cancelled"

/** How many the inbox shows at once; "Show older" loads the next lot. */
export const INBOX_PAGE = 30

/** Everyone who should hear about it, once each, never the person who did it. */
export function recipients(actorId: string, ids: (string | null | undefined)[]) {
  return [...new Set(ids.filter((id): id is string => !!id && id !== actorId))]
}

/** The words after the actor's name: "Dara *assigned you*". */
export function notificationVerb(kind: string, data: Record<string, unknown> | null) {
  switch (kind) {
    case "assigned":
      return "assigned you"
    case "commented":
      return "commented on"
    case "status_changed":
      return `moved to ${STATUS[data?.to as TaskStatus]?.label.toLowerCase() ?? "a new status"}`
    case "completed":
      return "completed"
    case "deadline_changed":
      return data?.to ? "changed the deadline of" : "removed the deadline of"
    case "feedback":
      return "gave you feedback"
    case "meeting_invited":
      return "invited you to"
    case "meeting_cancelled":
      return "cancelled"
    default:
      return "updated"
  }
}

// The push services browsers subscribe through (Chrome/Edge via FCM, Firefox, Safari, Windows). A saved endpoint is a URL
// the server will POST to, so anything else is refused: otherwise a member could point it at an internal address.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/]

export function isPushEndpoint(endpoint: string) {
  try {
    const u = new URL(endpoint)
    const host = u.hostname.toLowerCase().replace(/\.$/, "")
    return u.protocol === "https:" && !u.username && !u.password && !u.port && PUSH_HOSTS.some((r) => r.test(host))
  } catch {
    return false
  }
}

// A meeting without a task goes Home, where the Meetings list is.
export function notificationHref(n: { taskId: string | null; feedbackId: string | null }) {
  return n.feedbackId ? `/feedback/${n.feedbackId}` : n.taskId ? `/tasks/${n.taskId}` : "/"
}

/** The push message: who did what as the title, the task (and a comment's first words or a meeting's time) as the body. */
export function pushMessage(n: {
  kind: string
  actor: string
  subject: string | null
  data: Record<string, unknown> | null
  taskId: string | null
  feedbackId: string | null
}) {
  const preview = typeof n.data?.preview === "string" ? n.data.preview : null
  return {
    title: `${n.actor} ${notificationVerb(n.kind, n.data)}`,
    body: [n.subject, preview].filter(Boolean).join("\n"),
    url: notificationHref(n),
  }
}
