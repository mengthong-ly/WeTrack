// A page's `searchParams` as URLSearchParams, for the readers below and in task-views.ts.
export function toSearchParams(record: Record<string, string | string[] | undefined>) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(record)) for (const x of [v ?? []].flat()) q.append(k, x)
  return q
}

// Feedback board URL params (?who=, ?fixed=1, ?show=), read the same way on the server and the client. `who` is
// always in the key: with no ?who= the board opens on "For me" when there's something to fix, else "Everyone",
// and the client pins that choice into the URL so a later server render keeps the same tab.
export const FEEDBACK_PAGE = 40
const FEEDBACK_SHOW_MAX = 400
export const FEEDBACK_WHO = ["mine", "given", "all"] as const
export type FeedbackWho = (typeof FEEDBACK_WHO)[number]

export function readFeedbackParams(params: URLSearchParams, fallback: FeedbackWho) {
  const who = params.get("who")
  const show = Math.floor(Number(params.get("show")))
  return {
    who: FEEDBACK_WHO.includes(who as FeedbackWho) ? (who as FeedbackWho) : fallback,
    fixed: params.get("fixed") === "1",
    show: show > FEEDBACK_PAGE ? Math.min(show, FEEDBACK_SHOW_MAX) : FEEDBACK_PAGE,
  }
}
export type FeedbackParams = ReturnType<typeof readFeedbackParams>

export function feedbackKey(p: FeedbackParams) {
  const q = new URLSearchParams({ who: p.who })
  if (p.fixed) q.set("fixed", "1")
  if (p.show !== FEEDBACK_PAGE) q.set("show", String(p.show))
  return q.toString()
}
