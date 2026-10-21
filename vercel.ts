// Vercel cron schedules are UTC. 01:00 UTC Monday = 08:00 Monday in Asia/Phnom_Penh (APP_TIMEZONE default).
// Change the hour if APP_TIMEZONE changes.
// The meetings cron (every 5 minutes) is Vercel Pro only. On Hobby, drop it and enable
// .github/workflows/meeting-reminders.yml instead.
export const config = {
  crons: [
    { path: "/api/cron/digest", schedule: "0 1 * * 1" },
    { path: "/api/cron/meetings", schedule: "*/5 * * * *" },
  ],
}
