import "server-only"

import { eq, inArray } from "drizzle-orm"
import { after } from "next/server"
import webpush from "web-push"

import { db } from "@/lib/db"
import { notification, pushSubscription } from "@/lib/db/schema"
import { isPushEndpoint, pushMessage, recipients, type NotificationKind } from "@/lib/notifications"

// Push is optional: without VAPID keys the inbox still fills, nothing is pushed.
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const privateKey = process.env.VAPID_PRIVATE_KEY
const pushEnabled = !!(publicKey && privateKey)
if (pushEnabled) webpush.setVapidDetails(`mailto:${process.env.EMAIL_FROM ?? "wetrack@localhost"}`, publicKey, privateKey)

export type Notice = {
  orgId: string
  actor: { id: string; name: string }
  kind: NotificationKind
  /** Who it's for; the actor, blanks and repeats are dropped. */
  to: (string | null | undefined)[]
  /** The task or feedback title, for the push body. */
  subject: string | null
  taskId?: string | null
  feedbackId?: string | null
  data?: Record<string, unknown>
}

/** Puts it in each recipient's inbox, then pushes it to their browsers once the response has gone. */
export async function notify(n: Notice) {
  const ids = recipients(n.actor.id, n.to)
  if (!ids.length) return
  const taskId = n.taskId ?? null
  const feedbackId = n.feedbackId ?? null
  await db.insert(notification).values(
    ids.map((recipientId) => ({
      organizationId: n.orgId,
      recipientId,
      actorId: n.actor.id,
      kind: n.kind,
      taskId,
      feedbackId,
      data: n.data ?? null,
    }))
  )
  if (!pushEnabled) return
  const payload = JSON.stringify(
    pushMessage({ kind: n.kind, actor: n.actor.name, subject: n.subject, data: n.data ?? null, taskId, feedbackId })
  )
  after(async () => {
    const subs = await db.select().from(pushSubscription).where(inArray(pushSubscription.userId, ids))
    await Promise.all(
      // Checked again on the way out, in case a row got in some other way.
      subs.filter((s) => isPushEndpoint(s.endpoint)).map((s) =>
        webpush
          .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 })
          .catch(async (err: { statusCode?: number }) => {
            // Gone: the browser unsubscribed or the user cleared site data.
            if (err.statusCode === 404 || err.statusCode === 410)
              await db.delete(pushSubscription).where(eq(pushSubscription.endpoint, s.endpoint))
            else console.error("Push failed", err.statusCode)
          })
      )
    )
  })
}
