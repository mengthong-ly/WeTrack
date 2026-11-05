import { ArrowUpRightIcon, BrushIcon, GlobeIcon, PencilIcon } from "lucide-react"
import Link from "next/link"

import { Reveal } from "@/components/motion-bits"
import type { ProjectLinkKind } from "@/lib/db/schema"
import { linkHost } from "@/lib/link"
import { editProjectHref } from "@/lib/routes"

type Row = { id: string; kind: ProjectLinkKind; title: string; url: string }

const GROUPS = [
  { kind: "site", label: "Links", icon: GlobeIcon },
  { kind: "design", label: "Designs", icon: BrushIcon },
] as const

// A project's named links on its Overview: where it runs and where it was designed. They open in a new tab; the
// pencil goes to Edit project, where they're changed.
export function ProjectLinks({ projectId, links }: { projectId: string; links: Row[] }) {
  return (
    <Reveal index={3} className="flex flex-col gap-4 rounded-sheet bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg">Links</h2>
        <Link
          href={editProjectHref(projectId)}
          aria-label="Edit links"
          className="grid size-8 place-items-center rounded-lg text-muted-foreground outline-none transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
        >
          <PencilIcon className="size-4" />
        </Link>
      </div>
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add staging, production, the landing page or a Figma file in{" "}
          <Link href={editProjectHref(projectId)} className="text-foreground underline-offset-4 hover:underline">
            Edit project
          </Link>
          .
        </p>
      ) : (
        GROUPS.map(({ kind, label, icon: Icon }) => {
          const rows = links.filter((l) => l.kind === kind)
          return (
            rows.length > 0 && (
              <section key={kind} className="flex flex-col gap-1">
                <h3 className="px-1 pb-1 text-sm text-muted-foreground">{label}</h3>
                {rows.map((l) => (
                  <a
                    key={l.id}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex min-h-12 items-center gap-3 rounded-row bg-muted/60 px-3 outline-none transition-[background-color,scale] hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-99"
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{l.title}</span>
                      <span className="truncate text-xs text-muted-foreground">{linkHost(l.url)}</span>
                    </span>
                    <ArrowUpRightIcon className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-px group-hover:-translate-y-px" />
                  </a>
                ))}
              </section>
            )
          )
        })
      )}
    </Reveal>
  )
}
