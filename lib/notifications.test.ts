import assert from "node:assert/strict"
import { test } from "node:test"

import { isPushEndpoint, notificationHref, notificationVerb, pushMessage, recipients } from "./notifications.ts"

test("recipients drops the actor, blanks and repeats", () => {
  assert.deepEqual(recipients("me", ["me", "dara", null, undefined, "dara", "sok"]), ["dara", "sok"])
  assert.deepEqual(recipients("me", ["me", null]), [])
})

test("verbs read after the actor's name", () => {
  assert.equal(notificationVerb("status_changed", { to: "review" }), "moved to review / test")
  assert.equal(notificationVerb("deadline_changed", { to: null }), "removed the deadline of")
  assert.equal(notificationVerb("meeting_invited", null), "invited you to")
  assert.equal(notificationVerb("unknown", null), "updated")
})

test("only known push services are accepted as endpoints", () => {
  assert.ok(isPushEndpoint("https://fcm.googleapis.com/fcm/send/abc"))
  assert.ok(isPushEndpoint("https://web.push.apple.com/QG9"))
  assert.ok(isPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=x"))
  assert.ok(!isPushEndpoint("http://fcm.googleapis.com/fcm/send/abc"))
  assert.ok(!isPushEndpoint("https://169.254.169.254/latest"))
  assert.ok(!isPushEndpoint("https://evilpush.apple.com.attacker.net/x"))
  assert.ok(!isPushEndpoint("https://fcm.googleapis.com:8443/x"))
  assert.ok(!isPushEndpoint("https://user@fcm.googleapis.com/x"))
  assert.ok(!isPushEndpoint("not a url"))
})

test("feedback links win over the task", () => {
  assert.equal(notificationHref({ taskId: "t", feedbackId: "f" }), "/feedback/f")
  assert.equal(notificationHref({ taskId: "t", feedbackId: null }), "/tasks/t")
})

test("push message puts the comment under the task", () => {
  const m = pushMessage({ kind: "commented", actor: "Dara", subject: "Fix login", data: { preview: "Looks good" }, taskId: "t", feedbackId: null })
  assert.deepEqual(m, { title: "Dara commented on", body: "Fix login\nLooks good", url: "/tasks/t" })
})
