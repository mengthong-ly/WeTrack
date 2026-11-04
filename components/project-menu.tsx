"use client"

import { ArchiveIcon, MoreHorizontalIcon, PenLineIcon } from "lucide-react"
import Link from "next/link"
import { useTransition } from "react"
import { toast } from "sonner"

import { archiveProject, restoreProject } from "@/app/actions"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { editProjectHref } from "@/lib/routes"

// A project's row menu on Projects: edit it on its form page, or archive it (with an Undo, so no confirm()).
export function ProjectMenu({ project }: { project: { id: string; name: string } }) {
  const [, start] = useTransition()

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
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${project.name}`}
        className="grid size-8 place-items-center rounded-lg text-muted-foreground outline-none transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
      >
        <MoreHorizontalIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href={editProjectHref(project.id)} />}>
          <PenLineIcon />
          Edit project
        </DropdownMenuItem>
        <DropdownMenuItem onClick={archive}>
          <ArchiveIcon />
          Archive project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
