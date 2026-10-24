"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useState } from "react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// What the gallery collects: images in Markdown text (`.rich`) and anything marked `data-zoom`.
const IMAGES = ".rich img, [data-zoom] img"

/**
 * Click an image inside it and it opens large, with every other image in the same region (a task's
 * description and comments, a feedback point's note and screenshot) one arrow key or thumbnail away.
 */
export function ImageGallery({ children, className }: { children: React.ReactNode; className?: string }) {
  const [view, setView] = useState<{ srcs: string[]; at: number } | null>(null)

  function open(e: React.MouseEvent<HTMLDivElement>) {
    const hit = (e.target as Element).closest("img, [data-zoom]")
    const img = hit?.matches("img") ? hit : hit?.querySelector("img")
    if (!img || !img.matches(IMAGES)) return
    e.preventDefault()
    const imgs = [...e.currentTarget.querySelectorAll<HTMLImageElement>(IMAGES)]
    // The same image can show twice (e.g. pasted in two comments): list each once.
    const srcs = [...new Set(imgs.map((i) => i.getAttribute("src") ?? ""))].filter(Boolean)
    setView({ srcs, at: Math.max(0, srcs.indexOf(img.getAttribute("src") ?? "")) })
  }

  const go = (step: number) =>
    setView((v) => v && { ...v, at: (v.at + step + v.srcs.length) % v.srcs.length })
  const many = (view?.srcs.length ?? 0) > 1

  return (
    <div onClick={open} className={className}>
      {children}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent
          className="gap-2 rounded-tile bg-card p-2 sm:max-w-5xl"
          onKeyDown={(e) => {
            if (!many) return
            if (e.key === "ArrowLeft") go(-1)
            else if (e.key === "ArrowRight") go(1)
          }}
        >
          <DialogTitle className="sr-only">Image {view && `${view.at + 1} of ${view.srcs.length}`}</DialogTitle>
          {view && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- private, cookie-guarded image; next/image can't fetch it */}
              <img
                src={view.srcs[view.at]}
                alt=""
                className="max-h-[75dvh] w-full rounded-panel bg-muted object-contain"
              />
              {many && (
                <div className="flex items-center gap-2">
                  <NavButton label="Previous image" onClick={() => go(-1)}>
                    <ChevronLeftIcon className="size-4" />
                  </NavButton>
                  <ul className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto p-1">
                    {view.srcs.map((src, i) => (
                      <li key={src} className="shrink-0">
                        <button
                          type="button"
                          aria-label={`Image ${i + 1}`}
                          aria-current={i === view.at || undefined}
                          onClick={() => setView({ ...view, at: i })}
                          className={cn(
                            "block size-12 overflow-hidden rounded-row bg-muted opacity-60 outline-none transition-[opacity,scale] hover:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95",
                            i === view.at && "opacity-100 ring-2 ring-foreground"
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- private, cookie-guarded image */}
                          <img src={src} alt="" className="size-full object-cover" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <span className="tabular shrink-0 text-xs text-muted-foreground max-sm:hidden">
                    {view.at + 1} / {view.srcs.length}
                  </span>
                  <NavButton label="Next image" onClick={() => go(1)}>
                    <ChevronRightIcon className="size-4" />
                  </NavButton>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NavButton({ label, ...props }: { label: string } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      {...props}
      className="grid size-10 shrink-0 place-items-center rounded-full bg-muted outline-none transition-[background-color,scale] hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
    />
  )
}
