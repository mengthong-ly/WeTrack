import { redirect } from "next/navigation"

// Every visit starts in project selection mode: pick a project (or start one) before working on tasks.
export default function Home() {
  redirect("/projects")
}
