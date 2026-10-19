"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { createTask } from "@/app/actions"
import { ProjectDot } from "@/components/bits"
import { Pick } from "@/components/pick"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { TaskPriority, TaskStatus, TaskType } from "@/lib/db/enums"
import {
  type MemberLite,
  priorityOptions,
  type ProjectLite,
  statusOptions,
  typeOptions,
  UNASSIGNED,
} from "@/lib/options"

const LAST_PROJECT = "wetrack:last-project"

export function NewTaskDialog({
  open,
  onOpenChange,
  projects,
  members,
  meId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: ProjectLite[]
  members: MemberLite[]
  meId: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string>()
  // Remember the last project used; only read on the client (the dialog content never server-renders).
  const [projectId, setProjectId] = useState(() => {
    try {
      const last = typeof window === "undefined" ? null : localStorage.getItem(LAST_PROJECT)
      if (last && projects.some((p) => p.id === last)) return last
    } catch {}
    return projects[0]?.id ?? ""
  })
  const [priority, setPriority] = useState<TaskPriority>("normal")
  const [type, setType] = useState<TaskType>("development")
  const [status, setStatus] = useState<TaskStatus>("not_started")
  const [assigneeId, setAssigneeId] = useState(meId)

  function submit(form: FormData) {
    start(async () => {
      const res = await createTask({
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        projectId,
        assigneeId: assigneeId === UNASSIGNED ? null : assigneeId,
        type,
        priority,
        status,
        progress: 0,
        startDate: String(form.get("startDate") || "") || null,
        deadline: String(form.get("deadline") || "") || null,
      })
      if (res.error) return setError(res.error)
      try {
        localStorage.setItem(LAST_PROJECT, projectId)
      } catch {}
      setError(undefined)
      onOpenChange(false)
      toast.success("Task added", {
        action: { label: "Open", onClick: () => router.push(`/tasks/${res.id}`) },
      })
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 rounded-[2rem] p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">New task</DialogTitle>
        {projects.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-lg">Create a project first</p>
            <p className="mt-1 text-sm text-muted-foreground">Tasks live inside a project or client.</p>
            <Button className="mt-5 rounded-full" nativeButton={false} render={<Link href="/projects" />} onClick={() => onOpenChange(false)}>
              Go to projects
            </Button>
          </div>
        ) : (
          <form action={submit}>
            <div className="flex flex-col gap-1 p-6 pb-4">
              <Input
                name="title"
                required
                autoFocus
                placeholder="What needs doing?"
                aria-label="Task title"
                className="h-auto border-0 bg-transparent px-0 text-2xl shadow-none focus-visible:ring-0 md:text-2xl dark:bg-transparent"
              />
              <Textarea
                name="description"
                placeholder="Add a description…"
                aria-label="Description"
                className="min-h-16 resize-none border-0 bg-transparent px-0 text-muted-foreground shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
            </div>
            <div className="flex flex-wrap gap-2 px-6">
              <Pick
                aria-label="Project"
                value={projectId}
                onChange={setProjectId}
                options={projects.map((p) => ({
                  value: p.id,
                  label: (
                    <span className="flex items-center gap-2">
                      <ProjectDot color={p.color} />
                      {p.name}
                    </span>
                  ),
                }))}
              />
              <Pick aria-label="Priority" value={priority} onChange={(v) => setPriority(v as TaskPriority)} options={priorityOptions} />
              <Pick aria-label="Status" value={status} onChange={(v) => setStatus(v as TaskStatus)} options={statusOptions} />
              <Pick aria-label="Type" value={type} onChange={(v) => setType(v as TaskType)} options={typeOptions} />
              <Pick
                aria-label="Assignee"
                value={assigneeId}
                onChange={setAssigneeId}
                options={[
                  { value: UNASSIGNED, label: "Unassigned" },
                  ...members.map((m) => ({ value: m.id, label: m.id === meId ? `${m.name} (me)` : m.name })),
                ]}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 px-6 pt-4">
              <div className="grid gap-1.5">
                <Label htmlFor="startDate" className="text-xs text-muted-foreground">Start</Label>
                <Input id="startDate" name="startDate" type="date" className="h-9 rounded-full" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="deadline" className="text-xs text-muted-foreground">Deadline</Label>
                <Input id="deadline" name="deadline" type="date" className="h-9 rounded-full" />
              </div>
            </div>
            {error && <p className="px-6 pt-3 text-sm text-destructive" role="alert">{error}</p>}
            <div className="mt-6 flex items-center justify-between gap-3 border-t px-6 py-4">
              <span className="hidden text-xs text-muted-foreground sm:block">
                Press <kbd className="rounded border px-1">C</kbd> anywhere to add a task
              </span>
              <Button type="submit" size="lg" className="ml-auto h-10 rounded-full px-5" disabled={pending}>
                {pending ? "Adding…" : "Add task"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
