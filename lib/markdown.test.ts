import assert from "node:assert/strict"
import { test } from "node:test"

import { plainText } from "./markdown.ts"

test("plainText strips the Markdown RichText writes", () => {
  assert.equal(plainText("### Goal\n\nShip **the** _new_ ~~old~~ `api`"), "Goal Ship the new old api")
  assert.equal(plainText("- one\n- two\n1. three\n> quoted"), "one two three quoted")
  assert.equal(plainText("See [docs](https://x.dev) now"), "See docs now")
  assert.equal(plainText("```ts\nconst a = 1\n```"), "const a = 1")
  assert.equal(plainText("snake_case and 2 * 3"), "snake_case and 2 * 3")
  assert.equal(plainText("- [ ] buy milk\n- [x] call Dara"), "buy milk call Dara")
  assert.equal(plainText("Before ![](/api/attachments/abc) after\n\n---\n\nend"), "Before after end")
  assert.equal(plainText("# Goal\n\n&nbsp;\n\n## Steps"), "Goal Steps")
  assert.equal(plainText("costs \\$5 \\*not bold\\*"), "costs \\$5 *not bold*")
})
