import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { FeedbackDetail } from "@/components/feedback"
import { Reveal } from "@/components/motion-bits"
import { plainText } from "@/lib/markdown"
import { getFeedback } from "@/lib/queries"
import { requireMember } from "@/lib/session"

export async function generateMetadata({ params }: PageProps<"/feedback/[id]">): Promise<Metadata> {
  const me = await requireMember()
  const item = await getFeedback(me, (await params).id)
  return { title: item?.body ? plainText(item.body).slice(0, 60) : "Feedback" }
}

export default async function FeedbackPointPage({ params }: PageProps<"/feedback/[id]">) {
  const me = await requireMember()
  const item = await getFeedback(me, (await params).id)
  if (!item) notFound()

  return (
    <Reveal className="w-full">
      <FeedbackDetail item={item} />
    </Reveal>
  )
}
