import "server-only"

import { createHash, timingSafeEqual } from "node:crypto"

const sha = (s: string) => createHash("sha256").update(s).digest()

// The droplet's cron (deploy/staging-setup.sh) calls with `Authorization: Bearer $CRON_SECRET`.
export function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return timingSafeEqual(sha(request.headers.get("authorization") ?? ""), sha(`Bearer ${secret}`))
}
