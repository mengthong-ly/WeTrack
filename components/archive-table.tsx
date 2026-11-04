"use client"

import { ArchiveIcon, ArchiveRestoreIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react"
import { useTransition } from "react"
import { toast } from "sonner"

import { deleteProject, restoreProject } from "@/app/actions"
import { ProjectMark } from "@/components/bits"
import { Button } from "@/components/coss/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/coss/table"
import { DataEmpty, DataFrame, PageHead } from "@/components/data-table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export type ArchivedRow = { id: string; name: string; color: string; logo: string | null; tasks: number }

// Archived projects as a data table: Restore puts one back in Projects with its tasks; the row menu deletes it for good
// (owners and admins). Few enough to show at once, so no search or paging yet.
export function ArchiveTable({ projects, canDelete }: { projects: ArchivedRow[]; canDelete: boolean }) {
  return (
    <>
      <PageHead
        tone="info"
        icon={<ArchiveIcon />}
        title="Archive"
        count={projects.length}
        description="Projects you've put away. Restore one to bring it and its tasks back."
      />
      <DataFrame id="archive-table" title="Archived projects" total={projects.length}>
        {projects.length ? (
          <Table className="min-w-xl table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="ps-5">Project</TableHead>
                <TableHead className="w-24 text-right">Tasks</TableHead>
                <TableHead className="w-40 pe-5">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <Row key={p.id} project={p} canDelete={canDelete} />
              ))}
            </TableBody>
          </Table>
        ) : (
          <DataEmpty icon={<ArchiveIcon />} title="Nothing archived" description="Archive a project from its ⋯ menu on Projects and it waits here." />
        )}
      </DataFrame>
    </>
  )
}

function Row({ project: p, canDelete }: { project: ArchivedRow; canDelete: boolean }) {
  const [pending, start] = useTransition()

  function restore() {
    start(async () => {
      const res = await restoreProject(p.id)
      if (res.error) toast.error(res.error)
      else toast.success(`${p.name} restored`)
    })
  }

  function remove() {
    if (!confirm(`Delete “${p.name}” for good? Its ${p.tasks} tasks, feedback and client updates go with it. This can't be undone.`)) return
    start(async () => {
      const res = await deleteProject(p.id)
      if (res.error) toast.error(res.error)
      else toast.success(`${p.name} deleted`)
    })
  }

  return (
    <TableRow>
      <TableCell className="h-14 ps-5">
        <span className="flex min-w-0 items-center gap-3">
          <ProjectMark color={p.color} logo={p.logo} className="size-8" />
          <span className="truncate font-heading font-medium">{p.name}</span>
        </span>
      </TableCell>
      <TableCell className="tabular text-right text-muted-foreground">{p.tasks}</TableCell>
      <TableCell className="pe-3">
        <span className="flex items-center justify-end gap-1">
          <Button variant="outline" size="sm" disabled={pending} onClick={restore}>
            <ArchiveRestoreIcon />
            Restore
          </Button>
          {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`Actions for ${p.name}`}
                disabled={pending}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground outline-none transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
              >
                <MoreHorizontalIcon className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onClick={remove}>
                  <Trash2Icon />
                  Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </span>
      </TableCell>
    </TableRow>
  )
}
