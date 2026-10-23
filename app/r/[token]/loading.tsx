import { PageSkeleton } from "@/components/page-skeleton"

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-8 sm:pt-10">
      <PageSkeleton />
    </main>
  )
}
