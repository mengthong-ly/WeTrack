// Same rules as the spreadsheet formulas. Dates are "YYYY-MM-DD" strings (Postgres `date`).

export type Health = "done" | "overdue" | "due_soon" | "on_track" | "no_deadline"
export type ReleaseStage = "in_production" | "on_staging" | "scheduled" | "not_released"

export const DUE_SOON_DAYS = 3

export function todayISO(timeZone = process.env.APP_TIMEZONE ?? "Asia/Phnom_Penh") {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date())
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
