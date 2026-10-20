import assert from "node:assert/strict"
import { test } from "node:test"

import { daysLeft, doneThisWeek, effectiveProgress, health, projectHealth, releaseStage } from "./schedule.ts"

const today = "2026-10-19"
const t = (status: string, deadline: string | null) => ({ status, deadline })

test("health follows the spreadsheet rules", () => {
  assert.equal(health(t("completed", "2026-01-01"), today), "done")
  assert.equal(health(t("in_progress", null), today), "no_deadline")
  assert.equal(health(t("in_progress", "2026-10-18"), today), "overdue")
  assert.equal(health(t("in_progress", "2026-10-19"), today), "due_soon")
  assert.equal(health(t("in_progress", "2026-10-22"), today), "due_soon")
  assert.equal(health(t("in_progress", "2026-10-23"), today), "on_track")
})

test("daysLeft is null when done or undated, crosses month ends", () => {
  assert.equal(daysLeft(t("completed", "2026-10-25"), today), null)
  assert.equal(daysLeft(t("review", null), today), null)
  assert.equal(daysLeft(t("review", "2026-11-01"), today), 13)
  assert.equal(daysLeft(t("review", "2026-10-17"), today), -2)
})

test("completed counts as 100%", () => {
  assert.equal(effectiveProgress({ status: "completed", progress: 20 }), 100)
  assert.equal(effectiveProgress({ status: "in_progress", progress: 20 }), 20)
})

test("release stage prefers actual production over staging", () => {
  const r = { stagingPlanned: null, stagingActual: null, prodPlanned: null, prodActual: null }
  assert.equal(releaseStage(null), "not_released")
  assert.equal(releaseStage(r), "not_released")
  assert.equal(releaseStage({ ...r, prodPlanned: "2026-11-01" }), "scheduled")
  assert.equal(releaseStage({ ...r, stagingActual: "2026-10-20" }), "on_staging")
  assert.equal(releaseStage({ ...r, stagingActual: "2026-10-20", prodActual: "2026-10-21" }), "in_production")
})

test("project health: behind beats at risk beats on track", () => {
  assert.equal(projectHealth([], today), "done")
  assert.equal(projectHealth([t("completed", "2026-01-01")], today), "done")
  assert.equal(projectHealth([t("in_progress", "2026-11-30"), t("review", "2026-10-18")], today), "off_track")
  assert.equal(projectHealth([t("blocked", null)], today), "at_risk")
  assert.equal(projectHealth([t("not_started", "2026-10-21")], today), "at_risk")
  assert.equal(projectHealth([t("in_progress", "2026-11-30"), t("not_started", null)], today), "on_track")
})

test("done this week covers today and the 6 days before", () => {
  const done = (iso: string) => ({ status: "completed", deadline: null, completedAt: new Date(`${iso}T05:00:00Z`) })
  assert.equal(doneThisWeek(done("2026-10-19"), today), true)
  assert.equal(doneThisWeek(done("2026-10-13"), today), true)
  assert.equal(doneThisWeek(done("2026-10-12"), today), false)
  assert.equal(doneThisWeek({ ...done("2026-10-19"), status: "in_progress" }, today), false)
})
