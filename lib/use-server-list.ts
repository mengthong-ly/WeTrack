"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

export type ListPage<T> = { key: string; rows: T[]; total: number }

// A paged table whose state lives in the URL (filters, search, ?page=): the server renders the page for the URL it
// was asked for (`initial`); when the URL changes on the client (History API, no navigation) this fetches
// `${endpoint}?${key}` instead. A later server render for the current key (an edit refreshes the page) replaces
// what's loaded, so rows never go stale and optimistic updates hand over without a gap. `pending` while the URL is
// ahead of the rows: the old page stays on screen, dimmed, until the new one lands.
export function useServerList<P extends ListPage<{ id: string }>>(initial: P, key: string, endpoint: string) {
  const [page, setPage] = useState(initial)
  const [seen, setSeen] = useState(initial)
  if (initial !== seen) {
    setSeen(initial)
    if (initial.key === key) setPage(initial)
  }

  useEffect(() => {
    if (page.key === key) return
    const ctrl = new AbortController()
    fetch(`${endpoint}?${key}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((next: P) => setPage({ ...next, key }))
      .catch((e: Error) => e.name !== "AbortError" && toast.error("Couldn't load the list. Try again."))
    return () => ctrl.abort()
  }, [key, page, endpoint])

  return { ...page, pending: page.key !== key }
}

// A newest-first feed (comments, sent client updates): the server renders the latest rows and the total; `more`
// fetches `${endpoint}?offset=` for the next ones. Rows merge by id and everything seen is kept, so a new row from a
// later server render lands on top without pushing a loaded one out of the list.
export function useFeed<T extends { id: string }>(latest: T[], total: number, endpoint: string) {
  const [kept, setKept] = useState<T[]>([])
  const [seen, setSeen] = useState(latest)
  const [pending, setPending] = useState(false)
  if (latest !== seen) {
    setSeen(latest)
    setKept((k) => merge(seen, k))
  }
  const rows = merge(latest, kept)

  async function more() {
    setPending(true)
    try {
      const r = await fetch(`${endpoint}?offset=${rows.length}`)
      if (!r.ok) throw new Error(`${r.status}`)
      const next: { rows: T[] } = await r.json()
      setKept((k) => merge(k, next.rows))
    } catch {
      toast.error("Couldn't load more. Try again.")
    } finally {
      setPending(false)
    }
  }
  return { rows, left: Math.max(0, total - rows.length), more, pending }
}

const merge = <T extends { id: string }>(a: T[], b: T[]) => {
  const ids = new Set(a.map((r) => r.id))
  return [...a, ...b.filter((r) => !ids.has(r.id))]
}
