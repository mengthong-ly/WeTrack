import "server-only"

import { and, eq, like } from "drizzle-orm"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { account } from "@/lib/db/schema"
import { CALENDAR_SCOPE, googleError, type Slot } from "@/lib/meetings"

// Google Calendar over plain fetch. Tokens and response bodies never reach the logs: status codes only.

const EVENTS = "https://www.googleapis.com/calendar/v3/calendars/primary/events"

type GoogleEvent = {
  id: string
  htmlLink?: string
  hangoutLink?: string
  conferenceData?: {
    createRequest?: { status?: { statusCode?: string } }
    entryPoints?: { entryPointType?: string; uri?: string }[]
  }
}

// The user's Google account that granted the calendar scope (Better Auth stores scopes comma-separated).
async function calendarAccount(userId: string) {
  if (!process.env.GOOGLE_CLIENT_ID) return undefined
  return db.query.account.findFirst({
    columns: { id: true },
    where: and(
      eq(account.providerId, "google"),
      eq(account.userId, userId),
      like(account.scope, `%${CALENDAR_SCOPE}%`)
    ),
  })
}

export async function hasCalendar(userId: string): Promise<boolean> {
  return !!(await calendarAccount(userId))
}

/** A valid access token (Better Auth refreshes an expired one), or null when not connected. */
export async function googleToken(userId: string): Promise<string | null> {
  try {
    const row = await calendarAccount(userId)
    if (!row) return null
    const { accessToken } = await auth.api.getAccessToken({ body: { accountId: row.id, userId } })
    return accessToken ?? null
  } catch {
    return null
  }
}

const meetUrl = (e: GoogleEvent) =>
  e.hangoutLink ?? e.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri ?? null

function call(token: string, url: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  })
}

export async function createEvent(
  token: string,
  input: { title: string; description: string; slot: Slot; emails: string[]; tz: string }
): Promise<{ id: string; meetUrl: string | null; calendarUrl: string | null } | { error: string }> {
  try {
    const res = await call(token, `${EVENTS}?conferenceDataVersion=1&sendUpdates=all`, {
      method: "POST",
      body: JSON.stringify({
        summary: input.title,
        description: input.description,
        start: { dateTime: input.slot.startsAt.toISOString(), timeZone: input.tz },
        end: { dateTime: input.slot.endsAt.toISOString(), timeZone: input.tz },
        attendees: input.emails.map((email) => ({ email })),
        conferenceData: {
          createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } },
        },
      }),
    })
    if (!res.ok) {
      console.error(`Google Calendar create failed: ${res.status}`)
      return { error: googleError(res.status) }
    }
    const event = (await res.json()) as GoogleEvent
    let url = meetUrl(event)
    // Meet is sometimes still being set up; one re-read usually has the link.
    if (!url && event.conferenceData?.createRequest?.status?.statusCode === "pending") {
      url = (await getEvent(token, event.id))?.meetUrl ?? null
    }
    return { id: event.id, meetUrl: url, calendarUrl: event.htmlLink ?? null }
  } catch {
    console.error("Google Calendar create failed: network")
    return { error: googleError(0) }
  }
}

export async function getEvent(token: string, id: string): Promise<{ meetUrl: string | null } | null> {
  try {
    const res = await call(token, `${EVENTS}/${encodeURIComponent(id)}`)
    if (!res.ok) {
      console.error(`Google Calendar get failed: ${res.status}`)
      return null
    }
    return { meetUrl: meetUrl((await res.json()) as GoogleEvent) }
  } catch {
    return null
  }
}

export async function deleteEvent(token: string, id: string): Promise<{ ok: true } | { error: string }> {
  try {
    const res = await call(token, `${EVENTS}/${encodeURIComponent(id)}?sendUpdates=all`, { method: "DELETE" })
    // Already gone counts as done.
    if (res.ok || res.status === 404 || res.status === 410) return { ok: true }
    console.error(`Google Calendar delete failed: ${res.status}`)
    return { error: googleError(res.status) }
  } catch {
    console.error("Google Calendar delete failed: network")
    return { error: googleError(0) }
  }
}
