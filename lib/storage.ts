import "server-only"

import { AwsClient } from "aws4fetch"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { attachment } from "@/lib/db/schema"

// Images live in a private Cloudflare R2 bucket when R2_BUCKET is set, and are only ever read through
// /api/attachments/<id>, which checks the workspace. Without R2 (local dev) the bytes stay in the row.
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
const r2 =
  R2_BUCKET && R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
    ? new AwsClient({ service: "s3", region: "auto", accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY })
    : null
const objectUrl = (key: string) => `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`

export const IMAGE_TYPES = ["image/webp", "image/png", "image/jpeg", "image/gif"]
export const IMAGE_MAX = 4 * 1024 * 1024
export const isImage = (file: unknown): file is File =>
  file instanceof File && IMAGE_TYPES.includes(file.type) && file.size > 0 && file.size <= IMAGE_MAX

// Stores a checked image (see isImage) and returns its attachment id.
export async function saveImage(orgId: string, uploaderId: string, image: File): Promise<string> {
  const id = crypto.randomUUID()
  const bytes = Buffer.from(await image.arrayBuffer())
  let key: string | null = null
  if (r2) {
    key = `${orgId}/${id}`
    const res = await r2.fetch(objectUrl(key), {
      method: "PUT",
      body: bytes,
      headers: { "Content-Type": image.type },
    })
    if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`)
  }
  await db.insert(attachment).values({
    id,
    organizationId: orgId,
    uploaderId,
    type: image.type,
    key,
    data: key ? null : bytes,
  })
  return id
}

// Removes an attachment and its object. A failed R2 delete only leaves an unreachable object behind.
export async function deleteImage(id: string | null | undefined) {
  if (!id) return
  const [row] = await db.delete(attachment).where(eq(attachment.id, id)).returning({ key: attachment.key })
  if (row?.key && r2) {
    await r2.fetch(objectUrl(row.key), { method: "DELETE" }).catch((e) => console.error("R2 delete failed", e))
  }
}

// The image's bytes as a stream, or null when the object is gone.
export async function readImage(row: { key: string | null; data: Buffer | null }): Promise<BodyInit | null> {
  if (row.data) return new Uint8Array(row.data)
  if (!row.key || !r2) return null
  const res = await r2.fetch(objectUrl(row.key))
  return res.ok ? res.body : null
}
