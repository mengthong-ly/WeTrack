import { createHash, randomBytes } from "node:crypto"

export const AGENT_KEY_DAYS = 90
export const AGENT_KEY_LIMIT = 5

// 32 random bytes = 43 base64url characters.
export const newAgentKey = () => `wt_${randomBytes(32).toString("base64url")}`

// Same algorithm as hashShareToken in share.ts, which is server-only so it can't be imported here.
export const hashAgentKey = (key: string) => createHash("sha256").update(key).digest("hex")

export const isAgentKey = (s: string) => /^wt_[\w-]{43}$/.test(s)

/** The token from "Bearer <token>" (scheme is case-insensitive, one space), else null. */
export const bearerToken = (header: string | null) => /^bearer (\S+)$/i.exec(header ?? "")?.[1] ?? null
