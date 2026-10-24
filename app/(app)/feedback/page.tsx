import type { Metadata } from "next"
import { Suspense } from "react"

import { FeedbackBoard } from "@/components/feedback"
import { PageTransition, Reveal } from "@/components/motion-bits"
import { feedbackKey, readFeedbackParams, toSearchParams } from "@/lib/paging"
import { feedbackPage, openFeedback } from "@/lib/queries"
import { requireMember } from "@/lib/session"

export const metadata: Metadata = { title: "Feedback" }

// Renders the page of feedback the URL asks for (?who=, ?fixed=1, ?show=); FeedbackBoard fetches /api/feedback when
// it changes. With no ?who=, it opens on "For me" when there's something to fix, otherwise the whole team.
export default async function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  const me = await requireMember()
  const query = toSearchParams(await searchParams)
  const fallback = query.has("who") ? "all" : (await openFeedback(me.orgId, me.user.id)).mine > 0 ? "mine" : "all"
  const p = readFeedbackParams(query, fallback)
  const page = await feedbackPage(me, p.who, p.fixed, 0, p.show)

  return (
    <PageTransition>
      <div className="flex flex-col gap-6">
        <Reveal>
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
            Feedback
          </h1>
          <p className="mt-1 text-muted-foreground">
            Notes and screenshots on work. Tick it once it&apos;s fixed.
          </p>
        </Reveal>
        <Suspense>
          <FeedbackBoard initial={{ key: feedbackKey(p), ...page }} fallback={fallback} meId={me.user.id} />
        </Suspense>
      </div>
    </PageTransition>
  )
}
