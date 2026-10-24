import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { attachment } from "@/lib/db/schema"
import { requireMember } from "@/lib/session"
import { readImage } from "@/lib/storage"

// A stored image (task description or comment, feedback screenshot, project logo), for members of its
// workspace only. It never changes, so the browser keeps it (privately) for good.
export async function GET(_req: Request, ctx: RouteContext<"/api/attachments/[id]">) {
  const me = await requireMember()
  const { id } = await ctx.params
  const [row] = await db
    .select({ key: attachment.key, data: attachment.data, type: attachment.type })
    .from(attachment)
    .where(and(eq(attachment.id, id), eq(attachment.organizationId, me.orgId)))
  const body = row && (await readImage(row))
  if (!body) return new Response("Not found", { status: 404 })
  return new Response(body, {
    headers: {
      "Content-Type": row.type,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
