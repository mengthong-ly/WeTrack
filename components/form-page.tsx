import { PageHead } from "@/components/data-table"
import { Field, FieldDescription, FieldLabel } from "@/components/coss/field"
import { cn } from "@/lib/utils"

// The one template every create / edit form uses (coss.com's "New broadcast"): the page's icon tile and title with one
// muted line under it, then a single hairline card of stacked fields, each a label over its control with a hint under.
// Two short fields share a row (`FormRow`); the actions sit at the foot of the card, left. Checklist: DESIGN.md §4 "Form page".

export function FormPage({
  icon,
  tone,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  tone: Parameters<typeof PageHead>[0]["tone"]
  title: string
  description: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHead icon={icon} tone={tone} title={title} description={description} />
      {children}
    </div>
  )
}

// The card, as a <form>. `action` is a client function (it gets the FormData) or a server action.
export function FormCard({ action, className, children }: { action: (form: FormData) => void; className?: string; children: React.ReactNode }) {
  return (
    <form action={action} className={cn("flex flex-col gap-5 rounded-sheet border bg-card p-5 shadow-xs/5 sm:p-6", className)}>
      {children}
    </form>
  )
}

export function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2">{children}</div>
}

// A label over its control and a quiet hint under it. Pass a coss `Input` / `Textarea` as the child; for anything else
// (a photo, swatches) the label still names the group and `hint` explains it.
export function FormField({ label, hint, className, children }: { label: string; hint?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <Field className={cn("w-full", className)}>
      <FieldLabel>{label}</FieldLabel>
      {children}
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  )
}

export function FormActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 pt-1">{children}</div>
}

// A failed save: one line, under the fields.
export function FormError({ children }: { children?: string }) {
  return children ? (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  ) : null
}
