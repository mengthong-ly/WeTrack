import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { feedback } from "@/lib/db/schema"
import { requireMember } from "@/lib/session"

// A feedback screenshot, for members of its workspace only. A screenshot never changes, so the
// browser keeps it (privately) for good.
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/feedback/[id]">
) {
  const me = await requireMember()
  const { id } = await ctx.params
  const row = await db.query.feedback.findFirst({
    columns: { image: true, imageType: true },
    where: and(eq(feedback.id, id), eq(feedback.organizationId, me.orgId)),
  })
  if (!row?.image || !row.imageType)
    return new Response("Not found", { status: 404 })
  return new Response(new Uint8Array(row.image), {
    headers: {
      "Content-Type": row.imageType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
