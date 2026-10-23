import Hub from "@/components/ui/hub"

// The same poster ProjectScene shows while it sets up, in the same place, so the hand-off is seamless.
export default function Loading() {
  return (
    <div className="fixed inset-x-0 top-20 bottom-0 grid place-items-center sm:top-24" role="status">
      <div className="w-full max-w-64 px-6 text-center">
        <Hub play style={{ "--hairline-plate": "var(--background)" } as React.CSSProperties} aria-hidden />
        <p className="text-sm text-muted-foreground">Setting up your workspace</p>
      </div>
    </div>
  )
}
