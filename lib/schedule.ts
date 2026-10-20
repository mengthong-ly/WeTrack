// Same rules as the spreadsheet formulas. Dates are "YYYY-MM-DD" strings (Postgres `date`).

export type Health = "done" | "overdue" | "due_soon" | "on_track" | "no_deadline"
export type ReleaseStage = "in_production" | "on_staging" | "scheduled" | "not_released"

export const DUE_SOON_DAYS = 3

// The calendar day of `date` in the team's timezone, as "YYYY-MM-DD".
export function isoDay(date: Date, timeZone = process.env.APP_TIMEZONE ?? "Asia/Phnom_Penh") {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date)
}

export function todayISO(timeZone?: string) {
  return isoDay(new Date(), timeZone)
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
}

type Schedulable = { status: string; deadline: string | null }

export function daysLeft(t: Schedulable, today = todayISO()) {
  return t.deadline && t.status !== "completed" ? daysBetween(today, t.deadline) : null
}

export function health(t: Schedulable, today = todayISO()): Health {
  if (t.status === "completed") return "done"
  if (!t.deadline) return "no_deadline"
  const left = daysBetween(today, t.deadline)
  if (left < 0) return "overdue"
  return left <= DUE_SOON_DAYS ? "due_soon" : "on_track"
}

export function effectiveProgress(t: { status: string; progress: number }) {
  return t.status === "completed" ? 100 : t.progress
}

type Releasable = {
  stagingPlanned: string | null
  stagingActual: string | null
  prodPlanned: string | null
  prodActual: string | null
}

export function releaseStage(r: Releasable | null | undefined): ReleaseStage {
  if (!r) return "not_released"
  if (r.prodActual) return "in_production"
  if (r.stagingActual) return "on_staging"
  if (r.stagingPlanned || r.prodPlanned) return "scheduled"
  return "not_released"
}

export type Countable = Schedulable & { completedAt: Date | null }

// Completed in the 7 days ending today (today included).
export function doneThisWeek(t: Countable, today: string) {
  return t.status === "completed" && !!t.completedAt && daysBetween(isoDay(t.completedAt), today) < 7
}

export type ProjectHealth = "off_track" | "at_risk" | "on_track" | "done"

// Behind if anything open is overdue; at risk if something is blocked or due within 3 days.
export function projectHealth(tasks: Schedulable[], today: string): ProjectHealth {
  const open = tasks.filter((t) => t.status !== "completed")
  if (open.length === 0) return "done"
  if (open.some((t) => health(t, today) === "overdue")) return "off_track"
  if (open.some((t) => t.status === "blocked" || health(t, today) === "due_soon")) return "at_risk"
  return "on_track"
}
