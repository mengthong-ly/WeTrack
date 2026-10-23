import type { Metadata } from "next"

import { FeedbackBoard, type FeedbackItem } from "@/components/feedback"
import { Reveal } from "@/components/motion-bits"
import { listFeedback, listTasks } from "@/lib/queries"
import { requireMember } from "@/lib/session"
import { ago } from "@/lib/time"

export const metadata: Metadata = { title: "Feedback" }

export default async function FeedbackPage() {
  const me = await requireMember()
  const [rows, tasks] = await Promise.all([
    listFeedback(me.orgId),
    listTasks(me.orgId),
  ])

  const items: FeedbackItem[] = rows.map((f) => ({
    id: f.id,
    body: f.body,
    hasImage: !!f.imageType,
    resolved: !!f.resolvedAt,
    when: ago(f.createdAt),
    task: {
      id: f.task.id,
      title: f.task.title,
      color: f.task.project.color,
      project: f.task.project.name,
    },
    author: f.author,
    recipient: f.recipient,
    canDelete: f.authorId === me.user.id || me.role !== "member",
  }))
  // The tasks people were last working on come first in the picker.
  // ponytail: the 100 most recently touched, add a searchable picker if that's not enough.
  const taskOptions = tasks
    .toSorted((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 100)
    .map((t) => ({
      id: t.id,
      title: t.title,
      color: t.project.color,
      assignee: t.assignee?.name ?? null,
    }))

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
          Feedback
        </h1>
        <p className="mt-1 text-muted-foreground">
          Notes and screenshots on work. Tick a point once it&apos;s fixed.
        </p>
      </Reveal>
      <FeedbackBoard items={items} tasks={taskOptions} meId={me.user.id} />
    </div>
  )
}
