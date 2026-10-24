// Pure meeting rules: time zones, banner windows, email parsing and Slack text.
// No server-only or "@/" imports: used on the client too.

export const LEAD_MINUTES = 60

// Events on calendars the user owns: narrower than full calendar access (no settings or sharing).
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.owned"

export function googleError(status: number): string {
  if (status === 401) return "Connect Google Calendar again."
  if (status === 403) return "Google Calendar refused. Check the calendar permission and connect again."
  return "Google Calendar didn't accept the meeting. Try again."
}

export type Slot = { startsAt: Date; endsAt: Date }

export type MeetingLike = {
  title: string
  startsAt: Date
  endsAt: Date
  meetUrl: string | null
  calendarUrl: string | null
  canceledAt: Date | null
}

// Offset of `tz` at instant `at`, in ms ("GMT+07:00" -> 25200000, "GMT" -> 0).
function offsetMs(at: Date, tz: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT"
  const mt = /([+-])(\d{2}):(\d{2})/.exec(name)
  if (!mt) return 0
  return (mt[1] === "-" ? -1 : 1) * (Number(mt[2]) * 60 + Number(mt[3])) * 60000
}

/** Wall-clock `date` (YYYY-MM-DD) and `time` (HH:mm) in `tz`, as a UTC instant. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, mo, d] = date.split("-").map(Number)
  const [h, mi] = time.split(":").map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  const first = guess - offsetMs(new Date(guess), tz)
  // Second pass settles the offset when the first guess landed across a DST change.
  return new Date(guess - offsetMs(new Date(first), tz))
}

export function meetingSlot(date: string, start: string, end: string, tz: string): Slot | { error: string } {
  const startsAt = zonedToUtc(date, start, tz)
  const endsAt = zonedToUtc(date, end, tz)
  if (endsAt <= startsAt) return { error: "End time must be after the start." }
  return { startsAt, endsAt }
}

export function bannerState(
  m: MeetingLike,
  now: Date,
): { kind: "soon"; minutes: number } | { kind: "live" } | null {
  if (m.canceledAt) return null
  if (now >= m.startsAt) return now < m.endsAt ? { kind: "live" } : null
  const minutes = Math.ceil((m.startsAt.getTime() - now.getTime()) / 60000)
  return minutes <= LEAD_MINUTES ? { kind: "soon", minutes } : null
}

export const joinUrl = (m: MeetingLike) => m.meetUrl ?? m.calendarUrl

export type Viewer = { userId: string; email: string; role: string } | "share"

/** Who gets a Join link: invitees, the creator, owners and admins. The CEO share page sees all. */
export function canJoin(m: { createdById: string | null; attendeeEmails: string[] }, viewer: Viewer): boolean {
  if (viewer === "share") return true
  return (
    viewer.role !== "member" ||
    m.createdById === viewer.userId ||
    m.attendeeEmails.includes(viewer.email.toLowerCase())
  )
}

const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/

export function parseEmails(raw: string): { emails: string[]; invalid: string[] } {
  const emails: string[] = []
  const invalid: string[] = []
  for (const t of raw.split(/[\s,]+/).filter(Boolean)) {
    const list = EMAIL.test(t) ? emails : invalid
    const v = t.toLowerCase()
    if (!list.includes(v)) list.push(v)
  }
  return { emails, invalid }
}

function parts(d: Date, tz: string, opts: Intl.DateTimeFormatOptions) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", ...opts })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  )
}

const hhmm = (d: Date, tz: string) => {
  const p = parts(d, tz, { hour: "2-digit", minute: "2-digit" })
  return `${p.hour}:${p.minute}`
}

const day = (d: Date, tz: string) => {
  const p = parts(d, tz, { weekday: "short", day: "numeric", month: "short" })
  return `${p.weekday} ${p.day} ${p.month}`
}

/** "Wed 21 Oct, 14:00–14:30" */
export function formatSlot(s: Slot, tz: string): string {
  return `${day(s.startsAt, tz)}, ${hhmm(s.startsAt, tz)}–${hhmm(s.endsAt, tz)}`
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const joinLink = (m: MeetingLike) => {
  const url = joinUrl(m)
  return url ? ` · <${url}|Join>` : ""
}

export const slackCreated = (m: MeetingLike, by: string, tz: string) =>
  `📅 *${esc(m.title)}* · ${formatSlot(m, tz)} · scheduled by ${esc(by)}${joinLink(m)}`

/** "starts in 1 hour" from the cron, "starts in N min" when it fires late or the meeting was booked inside the hour. */
export function slackReminder(m: MeetingLike, tz: string, now: Date) {
  const min = Math.max(1, Math.ceil((m.startsAt.getTime() - now.getTime()) / 60000))
  const when = min === 60 ? "1 hour" : `${min} min`
  return `⏰ *${esc(m.title)}* starts in ${when} (${hhmm(m.startsAt, tz)})${joinLink(m)}`
}

export const slackCancelled = (m: MeetingLike, by: string, tz: string) =>
  `✖️ *${esc(m.title)}* on ${day(m.startsAt, tz)}, ${hhmm(m.startsAt, tz)} was cancelled by ${esc(by)}`

export type SlackMessage = { text: string; blocks: Record<string, unknown>[] }

const mrkdwn = (text: string) => ({ type: "mrkdwn", text })

/** The "Send to Slack" card: topic, description, when / organizer / attendees, Join. `text` is the notification fallback. */
export function slackMeetingCard(
  m: MeetingLike & { description: string | null },
  by: string,
  tz: string,
  attendees: string[],
): SlackMessage {
  // Slack rejects a header over 150 characters; titles may be 200.
  const title = m.title.length > 150 ? `${m.title.slice(0, 149)}…` : m.title
  const who = attendees.slice(0, 6).join(", ") + (attendees.length > 6 ? ` +${attendees.length - 6} more` : "")
  const url = joinUrl(m)
  return {
    text: slackCreated(m, by, tz),
    blocks: [
      { type: "header", text: { type: "plain_text", text: title } },
      ...(m.description?.trim() ? [{ type: "section", text: mrkdwn(esc(m.description.trim())) }] : []),
      {
        type: "section",
        fields: [
          mrkdwn(`*When*\n${formatSlot(m, tz)}`),
          mrkdwn(`*Organizer*\n${esc(by)}`),
          ...(who ? [mrkdwn(`*Attendees*\n${esc(who)}`)] : []),
        ],
      },
      ...(url
        ? [{ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Join meeting" }, url, style: "primary" }] }]
        : []),
    ],
  }
}
