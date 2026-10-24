import "server-only"

import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { workspaceIntegration } from "@/lib/db/schema"
import type { SlackMessage } from "@/lib/meetings"

// Slack over plain fetch. The webhook URL is a secret: it is never logged and never sent to the client.

async function webhookUrl(orgId: string) {
  const row = await db.query.workspaceIntegration.findFirst({
    columns: { slackWebhookUrl: true },
    where: eq(workspaceIntegration.organizationId, orgId),
  })
  return row?.slackWebhookUrl ?? null
}

export async function hasSlack(orgId: string) {
  return !!(await webhookUrl(orgId))
}

export async function postToWebhook(url: string, message: string | SlackMessage) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(typeof message === "string" ? { text: message } : message),
    // Slack answers an unknown webhook with a 302 to a web page that returns 200, so never follow redirects.
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Slack webhook failed (${res.status})`)
}

/** "skipped" means the workspace has no webhook. Throws when Slack answers non-2xx. */
export async function postSlack(orgId: string, message: string | SlackMessage): Promise<"sent" | "skipped"> {
  const url = await webhookUrl(orgId)
  if (!url) return "skipped"
  await postToWebhook(url, message)
  return "sent"
}
