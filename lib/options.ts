import { TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from "@/lib/db/enums"
import { PRIORITY, STATUS, TYPE } from "@/lib/labels"

export const statusOptions = TASK_STATUSES.map((v) => ({ value: v, label: STATUS[v].label }))
export const priorityOptions = TASK_PRIORITIES.map((v) => ({ value: v, label: PRIORITY[v].label }))
export const typeOptions = TASK_TYPES.map((v) => ({ value: v, label: TYPE[v] }))
export const UNASSIGNED = "none"

export type ProjectLite = { id: string; name: string; color: string }
export type MemberLite = { id: string; name: string; image: string | null }
