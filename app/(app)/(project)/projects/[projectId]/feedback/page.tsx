import type { Metadata } from "next"
import { Suspense } from "react"

import { FeedbackBoard } from "@/components/feedback"
import { Reveal } from "@/components/motion-bits"
import { feedbackKey, PAGE_SIZE, pageOffset, readFeedbackParams, toSearchParams } from "@/lib/paging"
import { feedbackPage, openFeedback } from "@/lib/queries"
import { requireMember } from "@/lib/session"

export const metadata: Metadata = { title: "Feedback" }

// This project's feedback for the URL's tab (?who=, ?fixed=1, ?page=); FeedbackBoard fetches /api/feedback when it
// changes. With no ?who=, it opens on "For me" when there's something to fix here, otherwise the whole team.
export default async function FeedbackPage({ params, searchParams }: PageProps<"/projects/[projectId]/feedback">) {
  const me = await requireMember()
  const { projectId } = await params
  const query = toSearchParams(await searchParams)
  const fallback = query.has("who") ? "all" : (await openFeedback(me.orgId, me.user.id, projectId)).mine > 0 ? "mine" : "all"
  const p = { ...readFeedbackParams(query, fallback), projectId }
  const page = await feedbackPage(me, projectId, p.who, p.fixed, pageOffset(p.page), PAGE_SIZE, p)

  return (
    <Reveal className="flex flex-col gap-6">
      <Suspense>
        <FeedbackBoard initial={{ key: feedbackKey(p), ...page }} fallback={fallback} meId={me.user.id} />
      </Suspense>
    </Reveal>
  )
}
