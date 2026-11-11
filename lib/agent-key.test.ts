import assert from "node:assert/strict"
import test from "node:test"

import { AGENT_KEY_DAYS, AGENT_KEY_LIMIT, bearerToken, hashAgentKey, isAgentKey, newAgentKey } from "./agent-key.ts"

test("new keys match the format and never repeat", () => {
  const a = newAgentKey()
  assert.ok(isAgentKey(a))
  assert.notEqual(a, newAgentKey())
})

test("hashAgentKey is stable sha256 hex", () => {
  assert.match(hashAgentKey("wt_x"), /^[0-9a-f]{64}$/)
  assert.equal(hashAgentKey("wt_x"), hashAgentKey("wt_x"))
})

test("isAgentKey rejects non-keys", () => {
  const body = "a".repeat(43)
  assert.ok(isAgentKey(`wt_${body}`))
  for (const s of ["", "wt_short", "abc", `wt_${body.slice(1)} `, `wt_a b${"a".repeat(40)}`, `wt_${body}a`]) {
    assert.equal(isAgentKey(s), false, JSON.stringify(s))
  }
})

test("bearerToken extracts the token or returns null", () => {
  assert.equal(bearerToken("Bearer wt_abc"), "wt_abc")
  assert.equal(bearerToken("bearer wt_abc"), "wt_abc")
  for (const h of ["Basic x", "Bearer", "Bearer  a b", null]) assert.equal(bearerToken(h), null, String(h))
})

test("limits", () => {
  assert.equal(AGENT_KEY_DAYS, 90)
  assert.equal(AGENT_KEY_LIMIT, 5)
})
