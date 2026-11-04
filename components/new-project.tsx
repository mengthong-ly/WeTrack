"use client"

import { PlusIcon } from "lucide-react"
import Link from "next/link"

import { AnimateIcon } from "@/components/animate-ui/icons/icon"
import { PlusIcon as AnimatedPlusIcon } from "@/components/animate-ui/icons/plus"
import { Button as CossButton } from "@/components/coss/button"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { PROJECT_COLORS } from "@/lib/labels"
import { CREATE_PROJECT_HREF } from "@/lib/routes"
import { cn } from "@/lib/utils"

// Every "New project" goes to the /create page. "tile": the dashed card. "button": a pill, for the 3D workspace's
// panels. "outline": the coss button over the picker's project list. "sidebar": the dark call to action at the top
// of project selection mode.
export function NewProject({ variant = "tile" }: { variant?: "tile" | "button" | "sidebar" | "outline" }) {
  if (variant === "outline")
    return (
      <CossButton render={<Link href={CREATE_PROJECT_HREF} />}>
        <PlusIcon />
        New project
      </CossButton>
    )
  if (variant === "sidebar")
    return (
      <AnimateIcon animateOnHover asChild>
        <SidebarMenuButton
          tooltip="New project"
          className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
          render={<Link href={CREATE_PROJECT_HREF} />}
        >
          <AnimatedPlusIcon />
          <span>New project</span>
        </SidebarMenuButton>
      </AnimateIcon>
    )
  return (
    <Link
      href={CREATE_PROJECT_HREF}
      className={
        variant === "tile"
          ? "flex min-h-48 w-full flex-col items-center justify-center gap-2 rounded-tile border-2 border-dashed border-foreground/10 text-muted-foreground transition hover:border-foreground/25 hover:text-foreground"
          : "inline-flex h-10 items-center gap-2 rounded-full bg-muted px-4 text-sm transition-[background-color,color,scale] hover:bg-foreground hover:text-background active:scale-95"
      }
    >
      <PlusIcon className={variant === "tile" ? "size-6" : "size-4"} />
      New project
    </Link>
  )
}

// The project colour choices, shared by New project and Edit project.
export function ColorSwatches({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">Colour</legend>
      {PROJECT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Colour ${c}`}
          aria-pressed={c === value}
          onClick={() => onChange(c)}
          className={cn("size-8 rounded-full ring-offset-2 ring-offset-popover transition", c === value && "ring-2 ring-foreground")}
          style={{ background: c }}
        />
      ))}
    </fieldset>
  )
}
