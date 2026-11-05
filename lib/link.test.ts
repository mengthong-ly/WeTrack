import assert from "node:assert/strict"
import { test } from "node:test"

import { linkHost, normalizeLink } from "./link.ts"

test("a bare domain gets https", () => assert.equal(normalizeLink("staging.weshop.com/app"), "https://staging.weshop.com/app"))
test("http and https stay as typed", () => {
  assert.equal(normalizeLink(" http://localhost:3000 "), "http://localhost:3000/")
  assert.equal(normalizeLink("https://figma.com/design/abc?node-id=1-2"), "https://figma.com/design/abc?node-id=1-2")
})
test("anything that isn't a web address is refused", () => {
  assert.equal(normalizeLink("javascript:alert(1)"), null)
  assert.equal(normalizeLink("ftp://x.com"), null)
  assert.equal(normalizeLink("not a url"), null)
  assert.equal(normalizeLink(""), null)
})
test("host for display drops www", () => assert.equal(linkHost("https://www.figma.com/design/x"), "figma.com"))
