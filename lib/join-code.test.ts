import assert from "node:assert/strict"
import test from "node:test"

import { formatJoinCode, newJoinCode, normalizeJoinCode } from "./join-code.ts"

test("formatJoinCode groups in fours, including partial input", () => {
  assert.equal(formatJoinCode("ABCD2345WXYZ"), "ABCD-2345-WXYZ")
  assert.equal(formatJoinCode("ABCD23"), "ABCD-23")
  assert.equal(formatJoinCode(""), "")
})

test("new codes round-trip through format and normalize", () => {
  for (let i = 0; i < 200; i++) {
    const code = newJoinCode()
    assert.equal(normalizeJoinCode(formatJoinCode(code)), code)
  }
})

test("normalizeJoinCode accepts typed variants and rejects non-codes", () => {
  assert.equal(normalizeJoinCode(" abcd-2345-wxyz "), "ABCD2345WXYZ")
  assert.equal(normalizeJoinCode("ABCD 2345 WXYZ"), "ABCD2345WXYZ")
  assert.equal(normalizeJoinCode("ABCD2345WXY"), null)
  assert.equal(normalizeJoinCode("ABCD2345WXYZA"), null)
  assert.equal(normalizeJoinCode("ABCD2O45WXYZ"), null) // O isn't in the alphabet
  assert.equal(normalizeJoinCode(""), null)
})
