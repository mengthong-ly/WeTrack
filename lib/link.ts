// A project link as people type it: "staging.site.com" becomes https://staging.site.com. Only web addresses pass;
// javascript:, ftp: and the like come back null.
export function normalizeLink(input: string): string | null {
  const text = input.trim()
  if (!text) return null
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(text) && !/^[^/\s]+:\d+/.test(text) ? text : `https://${text}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null
    return url.href
  } catch {
    return null
  }
}

// The host of a stored link, for the muted line under its title.
export function linkHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}
