// Turns "Fix login #asiamode @dara due fri !urgent" into a title plus task fields.
// Pure and import-free so node --test can load it. Dates are "YYYY-MM-DD".

export type Captured = {
  title: string
  projectId?: string
  assigneeId?: string
  priority?: "urgent" | "no_rush"
  deadline?: string
}

type Named = { id: string; name: string }

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

const toISO = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const addDays = (iso: string, n: number) => toISO(Date.parse(iso) + n * 86_400_000)
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

// One date phrase (without the "due"/"by" in front) → ISO day, or null.
export function parseDay(phrase: string, today: string): string | null {
  const p = phrase.toLowerCase().trim()
  if (p === "today") return today
  if (p === "tomorrow" || p === "tmr") return addDays(today, 1)
  if (p === "next week") return addDays(today, ((8 - new Date(today).getUTCDay()) % 7) || 7)
  const inN = p.match(/^in (\d{1,3}) (day|days|week|weeks)$/)
  if (inN) return addDays(today, Number(inN[1]) * (inN[2].startsWith("week") ? 7 : 1))
  const day = DAYS.findIndex((d, i) => p === d || p === DAY_NAMES[i] || (p.length > 3 && DAY_NAMES[i].startsWith(p)))
  if (day >= 0) return addDays(today, ((day - new Date(today).getUTCDay() + 7) % 7) || 7)
  // "24 oct" or "oct 24": this year, or next year if that day has passed.
  const dm = p.match(/^(\d{1,2}) ([a-z]{3})[a-z]*$/)
  const md = p.match(/^([a-z]{3})[a-z]* (\d{1,2})$/)
  const d = Number(dm?.[1] ?? md?.[2])
  const month = MONTHS.indexOf(dm?.[2] ?? md?.[1] ?? "")
  if (month >= 0 && d >= 1 && d <= 31) {
    const year = Number(today.slice(0, 4))
    const iso = toISO(Date.UTC(year, month, d))
    if (new Date(iso).getUTCMonth() !== month) return null // 31 feb
    return iso < today ? toISO(Date.UTC(year + 1, month, d)) : iso
  }
  return null
}

const DATE_WORDS =
  "today|tomorrow|tmr|next week|in \\d{1,3} (?:days?|weeks?)|(?:sun|mon|tue|wed|thu|fri|sat)[a-z]*|\\d{1,2} [a-z]{3,9}|[a-z]{3,9} \\d{1,2}"

export function parseCapture(
  text: string,
  { projects, members, meId, today }: { projects: Named[]; members: Named[]; meId?: string; today: string }
): Captured {
  const out: Captured = { title: text }
  let rest = ` ${text} `

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean) => {
    const m = rest.match(re)
    if (m && fn(m)) rest = rest.replace(m[0], " ")
  }

  take(/\s!(urgent|high|!)(?=\s)/i, () => ((out.priority = "urgent"), true))
  if (!out.priority) take(/\s!(low|later|norush)(?=\s)/i, () => ((out.priority = "no_rush"), true))

  take(/\s@(\S+)(?=\s)/, (m) => {
    const q = squash(m[1])
    const who =
      q === "me" && meId
        ? members.find((u) => u.id === meId)
        : members.find((u) => squash(u.name.split(" ")[0]) === q) ??
          members.find((u) => squash(u.name).startsWith(q))
    if (who) out.assigneeId = who.id
    return !!who
  })

  take(/\s#(\S+)(?=\s)/, (m) => {
    const q = squash(m[1])
    const p = projects.find((x) => squash(x.name) === q) ?? projects.find((x) => squash(x.name).startsWith(q))
    if (p) out.projectId = p.id
    return !!p
  })
  if (!out.projectId) {
    // "… for AsiaMode" — the project's full name after "for".
    for (const p of [...projects].sort((a, b) => b.name.length - a.name.length)) {
      const re = new RegExp(`\\sfor ${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s)`, "i")
      if (re.test(rest)) {
        out.projectId = p.id
        rest = rest.replace(re, " ")
        break
      }
    }
  }

  take(new RegExp(`\\s(?:due|by)\\s+(${DATE_WORDS})(?=\\s)`, "i"), (m) => {
    const d = parseDay(m[1], today)
    if (d) out.deadline = d
    return !!d
  })

  out.title = rest.replace(/\s+/g, " ").trim()
  return out
}
