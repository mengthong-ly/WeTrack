// Vercel cron schedules are UTC. 01:00 UTC Monday = 08:00 Monday in Asia/Phnom_Penh (APP_TIMEZONE default).
// Change the hour if APP_TIMEZONE changes.
export const config = {
  crons: [{ path: "/api/cron/digest", schedule: "0 1 * * 1" }],
}
