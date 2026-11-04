import { redirect } from "next/navigation"

// Feedback is per project now; the old board link goes to project selection.
export async function GET() {
  redirect("/projects")
}
