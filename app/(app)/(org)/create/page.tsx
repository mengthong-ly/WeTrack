import type { Metadata } from "next"

import { Reveal } from "@/components/motion-bits"
import { ProjectForm } from "@/components/project-form"

export const metadata: Metadata = { title: "New project" }

// A project is a client or product; tasks live inside it. Creating one goes straight into it.
export default function CreatePage() {
  return (
    <Reveal>
      <ProjectForm />
    </Reveal>
  )
}
