import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { attachment } from "@/lib/db/schema"
import { requireMember } from "@/lib/session"

// An image from a task description or comment, for members of its workspace only. It never
// changes, so the browser keeps it (privately) for good.
export async function GET(_req: Request, ctx: RouteContext<"/api/attachments/[id]">) {
  const me = await requireMember()
  const { id } = await ctx.params
  const [row] = await db
    .select({ data: attachment.data, type: attachment.type })
    .from(attachment)
    .where(and(eq(attachment.id, id), eq(attachment.organizationId, me.orgId)))
  if (!row) return new Response("Not found", { status: 404 })
  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.type,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
