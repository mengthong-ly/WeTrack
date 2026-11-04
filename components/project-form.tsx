"use client"

import { BlocksIcon, ImageOffIcon, ImagePlusIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import { createProject, setProjectLogo, updateProject } from "@/app/actions"
import { ProjectDot } from "@/components/bits"
import { Button } from "@/components/coss/button"
import { Input } from "@/components/coss/input"
import { Textarea } from "@/components/coss/textarea"
import { FormActions, FormCard, FormError, FormField, FormPage } from "@/components/form-page"
import { ColorSwatches } from "@/components/new-project"
import { imageForm, shrink } from "@/lib/image"
import { PROJECT_COLORS } from "@/lib/labels"
import { projectHref } from "@/lib/routes"
import { cn } from "@/lib/utils"

type Initial = { id: string; name: string; description: string | null; color: string; logo: string | null }
type Photo = { blob?: Blob; url: string } | null

const pill =
  "inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-[background-color,scale] hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"

// New project (/create) and Edit project (/projects/<id>/edit): the same form page. The photo is the project's logo,
// shrunk to 512px in the browser and shown at once; on create nothing is stored until Create, on edit it is saved with the rest.
export function ProjectForm({ project }: { project?: Initial }) {
  const router = useRouter()
  const [name, setName] = useState(project?.name ?? "")
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[6])
  const [photo, setPhoto] = useState<Photo>(project?.logo ? { url: project.logo } : null)
  const [photoChanged, setPhotoChanged] = useState(false)
  const [error, setError] = useState<string>()
  const [pending, start] = useTransition()

  useEffect(() => () => void (photo?.blob && URL.revokeObjectURL(photo.url)), [photo])

  async function pick(file: File) {
    const blob = await shrink(file, 512)
    setPhoto({ blob, url: URL.createObjectURL(blob) })
    setPhotoChanged(true)
  }

  function submit(form: FormData) {
    const fields = { name, description: String(form.get("description") ?? ""), color }
    start(async () => {
      if (!project) {
        const data = new FormData()
        for (const [k, v] of Object.entries(fields)) data.set(k, v)
        if (photo?.blob) data.set("logo", photo.blob, `logo.${photo.blob.type.split("/")[1]}`)
        const res = await createProject(data)
        if (res.error) return setError(res.error)
        toast.success("Project created")
        return router.push(projectHref(res.id!))
      }
      const res = await updateProject(project.id, fields)
      if (res.error) return setError(res.error)
      if (photoChanged) {
        const logo = await setProjectLogo(project.id, photo?.blob ? imageForm("logo", photo.blob) : new FormData())
        if (logo.error) return setError(logo.error)
      }
      toast.success("Project updated")
      router.push(projectHref(project.id))
    })
  }

  return (
    <FormPage
      icon={<BlocksIcon />}
      tone="warning"
      title={project ? "Edit project" : "New project"}
      description={project ? `Change how ${project.name} looks and reads everywhere.` : "A client or product. Tasks, feedback and client updates live inside it."}
    >
      <FormCard action={submit}>
        <FormField label="Photo" hint="Optional. Shown instead of the colour dot. PNG, JPG, WebP or GIF; square looks best.">
          <div className="flex items-center gap-4">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local preview or the private, cookie-guarded logo
              <img src={photo.url} alt="" className="size-16 shrink-0 rounded-full bg-card object-contain ring-1 ring-foreground/10" />
            ) : (
              <span aria-hidden className="relative grid size-16 shrink-0 place-items-center rounded-full bg-muted font-heading text-2xl font-light ring-1 ring-foreground/10">
                {name.trim().slice(0, 1).toUpperCase() || <ImagePlusIcon className="size-5 text-muted-foreground" />}
                <ProjectDot color={color} className="absolute right-0.5 bottom-0.5 size-3.5 ring-2 ring-card" />
              </span>
            )}
            <div className="flex flex-wrap gap-2">
              <label className={pill}>
                <ImagePlusIcon className="size-4" />
                {photo ? "Replace photo" : "Upload photo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0]
                    e.currentTarget.value = ""
                    if (file) pick(file)
                  }}
                />
              </label>
              {photo && (
                <button
                  type="button"
                  className={cn(pill, "border-transparent bg-transparent shadow-none")}
                  onClick={() => {
                    setPhoto(null)
                    setPhotoChanged(true)
                  }}
                >
                  <ImageOffIcon className="size-4" />
                  Remove
                </button>
              )}
            </div>
          </div>
        </FormField>

        <FormField label="Name" hint="Shown in every list and in the project switcher.">
          <Input size="lg" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoFocus placeholder="Acme website" />
        </FormField>

        <FormField label="Description" hint="Optional. Shown under the project's name on its Overview.">
          <Textarea name="description" defaultValue={project?.description ?? ""} maxLength={2000} rows={4} placeholder="What is this project? Who is it for?" />
        </FormField>

        <FormField label="Colour" hint="The dot that marks this project's tasks and rows.">
          <ColorSwatches value={color} onChange={setColor} />
        </FormField>

        <FormError>{error}</FormError>
        <FormActions>
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? "Saving…" : project ? "Save changes" : "Create project"}
          </Button>
          <Button variant="ghost" render={<Link href={project ? projectHref(project.id) : "/projects"} />}>
            Cancel
          </Button>
        </FormActions>
      </FormCard>
    </FormPage>
  )
}
