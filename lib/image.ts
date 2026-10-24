import { toast } from "sonner"

import { uploadImage } from "@/app/actions"

// Images are shrunk in the browser (at most 2000px wide, WebP or JPEG) so an upload stays small.
export async function shrink(file: Blob): Promise<Blob> {
  if (file.type === "image/gif") return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 2000 / bitmap.width)
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const type of ["image/webp", "image/jpeg"]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.85))
      if (blob?.type === type) return blob
    }
  } catch {}
  return file
}

// Stores an image for a task description or comment and returns its URL, or null (with a toast) on failure.
export async function uploadTo(image: Blob): Promise<string | null> {
  const form = new FormData()
  form.set("image", image, `image.${image.type.split("/")[1]}`)
  const res = await uploadImage(form)
  if (res.error) toast.error(res.error)
  return res.src ?? null
}
