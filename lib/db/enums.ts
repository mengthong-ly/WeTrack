export const TASK_STATUSES = ["not_started", "in_progress", "review", "blocked", "completed"] as const
export const TASK_PRIORITIES = ["urgent", "normal", "no_rush"] as const
export const TASK_TYPES = ["development", "design", "bug_fix"] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]
export type TaskPriority = (typeof TASK_PRIORITIES)[number]
export type TaskType = (typeof TASK_TYPES)[number]
