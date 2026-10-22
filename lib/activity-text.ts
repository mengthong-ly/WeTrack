import type { TaskStatus } from "@/lib/db/enums"
import { STATUS } from "@/lib/labels"

export function describeActivity(
  kind: string,
  data: Record<string, unknown> | null
) {
  switch (kind) {
    case "task_created":
      return "added"
    case "task_completed":
      return "completed"
    case "status_changed":
      return `moved to ${STATUS[data?.to as TaskStatus]?.label.toLowerCase() ?? "a new status"}`
    case "deadline_changed":
      return "changed the deadline of"
    case "client_update_sent":
      return `sent a client update to ${String(data?.project ?? "a client")}`
    case "meeting_scheduled":
      return "scheduled a meeting on"
    default:
      return "updated"
  }
}
