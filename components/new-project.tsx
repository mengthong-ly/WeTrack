"use client"

import { PlusIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { createProject } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { PROJECT_COLORS } from "@/lib/labels"
import { cn } from "@/lib/utils"

export function NewProject() {
  const [open, setOpen] = useState(false)
  const [color, setColor] = useState(PROJECT_COLORS[6])
  const [error, setError] = useState<string>()
  const [pending, start] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="flex min-h-48 w-full flex-col items-center justify-center gap-2 rounded-tile border-2 border-dashed border-foreground/10 text-muted-foreground transition hover:border-foreground/25 hover:text-foreground">
        <PlusIcon className="size-6" />
        New project
      </DialogTrigger>
      <DialogContent className="rounded-tile p-6 sm:max-w-sm">
        <DialogTitle className="text-xl font-normal">New project</DialogTitle>
        <form
          className="mt-2 flex flex-col gap-4"
          action={(form) =>
            start(async () => {
              const res = await createProject({ name: String(form.get("name") ?? ""), color })
              if (res.error) return setError(res.error)
              setOpen(false)
              setError(undefined)
              toast.success("Project created")
            })
          }
        >
          <Input name="name" placeholder="Client or product name" required autoFocus aria-label="Project name" className="h-10 rounded-full px-4" />
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Colour</legend>
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
                className={cn("size-8 rounded-full ring-offset-2 ring-offset-popover transition", c === color && "ring-2 ring-foreground")}
                style={{ background: c }}
              />
            ))}
          </fieldset>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="h-10 rounded-full" disabled={pending}>
            {pending ? "Creating…" : "Create project"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
