"use client"

import { BrushIcon, GlobeIcon, PlusIcon, XIcon } from "lucide-react"

import { Button } from "@/components/coss/button"
import { Input } from "@/components/coss/input"
import { FormField } from "@/components/form-page"
import type { ProjectLinkKind } from "@/lib/db/schema"

export type LinkDraft = { kind: ProjectLinkKind; title: string; url: string }

const KINDS = {
  site: { label: "Links", hint: "Where it runs: staging, production, the landing page.", icon: GlobeIcon, add: "Add link", title: "Staging", url: "staging.acme.com" },
  design: { label: "Designs", hint: "Figma files, prototypes, brand boards.", icon: BrushIcon, add: "Add design", title: "Home page", url: "figma.com/design/…" },
} as const

// Edit a project's named links in the project form: one block per kind, a title and a URL per row. Empty rows are
// dropped on save, and a URL without https:// gets it.
export function ProjectLinksField({ value, onChange }: { value: LinkDraft[]; onChange: (links: LinkDraft[]) => void }) {
  return (
    <>
      {(Object.keys(KINDS) as ProjectLinkKind[]).map((kind) => {
        const k = KINDS[kind]
        const rows = value.map((l, i) => ({ l, i })).filter((r) => r.l.kind === kind)
        const set = (i: number, patch: Partial<LinkDraft>) => onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)))
        return (
          <FormField key={kind} label={k.label} hint={k.hint}>
            <div className="flex flex-col gap-2">
              {rows.map(({ l, i }) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    aria-label={`${k.label} title`}
                    className="w-2/5 min-w-0"
                    value={l.title}
                    onChange={(e) => set(i, { title: e.target.value })}
                    maxLength={80}
                    placeholder={k.title}
                  />
                  <Input
                    aria-label={`${k.label} URL`}
                    inputMode="url"
                    className="min-w-0 flex-1"
                    value={l.url}
                    onChange={(e) => set(i, { url: e.target.value })}
                    placeholder={k.url}
                  />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                    <XIcon />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => onChange([...value, { kind, title: "", url: "" }])}
              >
                <PlusIcon />
                {k.add}
              </Button>
            </div>
          </FormField>
        )
      })}
    </>
  )
}
