"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

export type ListPage<T> = { key: string; rows: T[]; total: number }

// A list whose state lives in the URL (filters, search, ?show= for how many rows): the server renders the page
// for the URL it was asked for (`initial`); when the URL changes on the client (History API, no navigation) this
// fetches `${endpoint}?${key}` instead. Raising only ?show= fetches just the missing rows (?offset=) and appends
// them. A later server render for the current key (an edit refreshes the page) replaces what's loaded, so rows
// never go stale and optimistic updates hand over without a gap. `pending` while the URL is ahead of the rows,
// `appending` when that's only Load more.
export function useServerList<P extends ListPage<{ id: string }>>(initial: P, key: string, endpoint: string) {
  const [page, setPage] = useState(initial)
  const [seen, setSeen] = useState(initial)
  if (initial !== seen) {
    setSeen(initial)
    if (initial.key === key) setPage(initial)
  }

  useEffect(() => {
    if (page.key === key) return
    const want = new URLSearchParams(key)
    const more =
      withoutShow(want) === withoutShow(new URLSearchParams(page.key)) &&
      page.rows.length < page.total &&
      Number(want.get("show")) > page.rows.length
    if (more) want.set("offset", String(page.rows.length))
    const ctrl = new AbortController()
    fetch(`${endpoint}?${want}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((next: P) => {
        if (!more) return setPage({ ...next, key })
        const ids = new Set(page.rows.map((r) => r.id))
        setPage({ ...next, key, rows: [...page.rows, ...next.rows.filter((r) => !ids.has(r.id))] })
      })
      .catch((e: Error) => e.name !== "AbortError" && toast.error("Couldn't load the list. Try again."))
    return () => ctrl.abort()
  }, [key, page, endpoint])

  // Only ?show= went up: the rows on screen stay valid and the next ones are on their way.
  const appending = page.key !== key && withoutShow(new URLSearchParams(key)) === withoutShow(new URLSearchParams(page.key))
  return { ...page, pending: page.key !== key, appending }
}

function withoutShow(q: URLSearchParams) {
  const c = new URLSearchParams(q)
  c.delete("show")
  c.sort()
  return c.toString()
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
