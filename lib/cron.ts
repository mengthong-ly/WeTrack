import "server-only"

import { createHash, timingSafeEqual } from "node:crypto"

const sha = (s: string) => createHash("sha256").update(s).digest()

// Vercel cron (and the GitHub workflow) call with `Authorization: Bearer $CRON_SECRET`.
export function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return timingSafeEqual(sha(request.headers.get("authorization") ?? ""), sha(`Bearer ${secret}`))
}
