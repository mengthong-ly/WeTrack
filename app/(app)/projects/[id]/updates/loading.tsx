import { PageSkeleton } from "@/components/page-skeleton"

// The page reads the session and project, and the loading boundaries above sit outside a navigation between
// projects' updates, so this segment needs its own. No tiles: the page is a list and a composer.
export default function Loading() {
  return <PageSkeleton tiles={false} />
}
