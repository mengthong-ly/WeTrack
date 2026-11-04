import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { FeedbackDetail } from "@/components/feedback"
import { Reveal } from "@/components/motion-bits"
import { plainText } from "@/lib/markdown"
import { getFeedback } from "@/lib/queries"
import { feedbackHref } from "@/lib/routes"
import { requireMember } from "@/lib/session"

export async function generateMetadata({ params }: PageProps<"/projects/[projectId]/feedback/[feedbackId]">): Promise<Metadata> {
  const me = await requireMember()
  const item = await getFeedback(me, (await params).feedbackId)
  return { title: item?.body ? plainText(item.body).slice(0, 60) : "Feedback" }
}

export default async function FeedbackPointPage({ params }: PageProps<"/projects/[projectId]/feedback/[feedbackId]">) {
  const me = await requireMember()
  const { projectId, feedbackId } = await params
  const item = await getFeedback(me, feedbackId)
  if (!item) notFound()
  // Its task moved to another project: open it there.
  if (item.projectId && item.projectId !== projectId) redirect(feedbackHref(item.projectId, feedbackId))

  return (
    <Reveal className="w-full">
      <FeedbackDetail item={item} />
    </Reveal>
  )
}
