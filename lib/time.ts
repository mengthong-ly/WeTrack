const TZ = process.env.APP_TIMEZONE ?? "Asia/Phnom_Penh"

export function greeting(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(now))
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
}

export function longDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(now)
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
export function ago(date: Date, now = new Date()) {
  const s = (date.getTime() - now.getTime()) / 1000
  for (const [unit, secs] of [["day", 86400], ["hour", 3600], ["minute", 60]] as const) {
    if (Math.abs(s) >= secs) return rtf.format(Math.round(s / secs), unit)
  }
  return "just now"
}
