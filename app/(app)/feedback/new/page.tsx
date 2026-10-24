import type { Metadata } from "next"

import { type FeedbackTask, GiveFeedback } from "@/components/feedback"
import { PageTransition, Reveal } from "@/components/motion-bits"
import { listMembers, listTasks } from "@/lib/queries"
import { requireMember } from "@/lib/session"

export const metadata: Metadata = { title: "Give feedback" }

export default async function GiveFeedbackPage({ searchParams }: PageProps<"/feedback/new">) {
  const me = await requireMember()
  const [tasks, members, { task }] = await Promise.all([listTasks(me.orgId), listMembers(me.orgId), searchParams])
  const linked = typeof task === "string" ? task : undefined
  // Optional: feedback can name a task, or just go to a person.
  // The tasks people were last working on come first in the picker, plus the task the link names.
  // ponytail: the 100 most recently touched, add a searchable picker if that's not enough.
  const recent = tasks.toSorted((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  const options: FeedbackTask[] = recent
    .filter((t, i) => i < 100 || t.id === linked)
    .map((t) => ({ id: t.id, title: t.title, color: t.project.color, assigneeId: t.assignee?.id ?? null }))

  return (
    <PageTransition>
      <Reveal className="w-full">
        <GiveFeedback key={linked} tasks={options} people={members} taskId={options.some((t) => t.id === linked) ? linked : undefined} />
      </Reveal>
    </PageTransition>
  )
}
