"use client"

import { ArchiveIcon, MoreHorizontalIcon, PenLineIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { archiveProject, restoreProject, updateProject } from "@/app/actions"
import { ColorSwatches } from "@/components/new-project"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

// A project's row menu on Projects: rename or recolour it, or archive it (with an Undo, so no confirm()).
export function ProjectMenu({ project }: { project: { id: string; name: string; color: string } }) {
  const [editing, setEditing] = useState(false)
  const [color, setColor] = useState(project.color)
  const [error, setError] = useState<string>()
  const [pending, start] = useTransition()

  function archive() {
    start(async () => {
      const res = await archiveProject(project.id)
      if (res.error) return void toast.error(res.error)
      toast.success(`${project.name} archived`, {
        action: { label: "Undo", onClick: () => void restoreProject(project.id) },
      })
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${project.name}`}
          className="grid size-8 place-items-center rounded-lg text-muted-foreground outline-none transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
        >
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setColor(project.color)
              setError(undefined)
              setEditing(true)
            }}
          >
            <PenLineIcon />
            Edit project
          </DropdownMenuItem>
          <DropdownMenuItem onClick={archive}>
            <ArchiveIcon />
            Archive project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="rounded-tile p-6 sm:max-w-sm">
          <DialogTitle className="text-xl font-normal">Edit project</DialogTitle>
          <form
            className="mt-2 flex flex-col gap-4"
            action={(form) =>
              start(async () => {
                const res = await updateProject(project.id, { name: String(form.get("name") ?? ""), color })
                if (res.error) return setError(res.error)
                setEditing(false)
                toast.success("Project updated")
              })
            }
          >
            <Input name="name" defaultValue={project.name} required autoFocus aria-label="Project name" className="h-10 rounded-full px-4" />
            <ColorSwatches value={color} onChange={setColor} />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="h-10 rounded-full" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
