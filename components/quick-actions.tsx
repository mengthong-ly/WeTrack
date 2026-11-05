"use client"

import { CalendarPlusIcon, FolderPlusIcon, LayersIcon, PlusIcon } from "lucide-react"
import Link from "next/link"

import { NEW_TASK_EVENT } from "@/components/command-menu"
import { Kbd } from "@/components/ui/kbd"
import { openNewMeeting } from "@/components/new-meeting-dialog"
import { ACCENT, type Accent } from "@/lib/labels"
import { CREATE_PROJECT_HREF } from "@/lib/routes"
import { cn } from "@/lib/utils"

const tile =
  "group flex min-h-16 items-center gap-3 rounded-card bg-card px-4 text-left shadow-sm outline-none transition-[background-color,scale] hover:bg-muted/80 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-98"
const mark = (accent: Accent) => cn("grid size-10 shrink-0 place-items-center rounded-lg transition-colors [&_svg]:size-5", ACCENT[accent].tile)

// Home's shortcuts: the things you start most. New task opens the New task page of the project you pick (or the one
// you are in); the rest go where the sidebar and ⌘K already go.
export function QuickActions() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <button type="button" className={tile} onClick={() => window.dispatchEvent(new Event(NEW_TASK_EVENT))}>
        <span className={mark("sky")}>
          <PlusIcon />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm">New task</span>
          <span className="truncate text-xs text-muted-foreground">Into a project</span>
        </span>
        <Kbd className="ml-auto">C</Kbd>
      </button>
      <Link href={CREATE_PROJECT_HREF} className={tile}>
        <span className={mark("violet")}>
          <FolderPlusIcon />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm">New project</span>
          <span className="truncate text-xs text-muted-foreground">A client or product</span>
        </span>
      </Link>
      <button type="button" className={tile} onClick={() => openNewMeeting()}>
        <span className={mark("emerald")}>
          <CalendarPlusIcon />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm">New meeting</span>
          <span className="truncate text-xs text-muted-foreground">Google Meet with the team</span>
        </span>
      </button>
      <Link href="/workspace" className={tile}>
        <span className={mark("amber")}>
          <LayersIcon />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm">Workspace</span>
          <span className="truncate text-xs text-muted-foreground">Every project at once</span>
        </span>
      </Link>
    </div>
  )
}
