// Vercel cron schedules are UTC. 01:00 UTC Monday = 08:00 Monday in Asia/Phnom_Penh (APP_TIMEZONE default).
// Change the hour if APP_TIMEZONE changes.
// Meeting reminders need a 5-minute schedule, which Vercel Hobby doesn't allow. They run from
// .github/workflows/meeting-reminders.yml instead. On Pro, add
// { path: "/api/cron/meetings", schedule: "*/5 * * * *" } here and turn the workflow off.
export const config = {
  crons: [{ path: "/api/cron/digest", schedule: "0 1 * * 1" }],
}
