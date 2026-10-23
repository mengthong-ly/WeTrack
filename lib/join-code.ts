// No I, O, 0 or 1, so a code read aloud or off a screen can't be mistyped. 32^12 = 2^60 codes, so
// guessing one is hopeless even with every workspace's code live and no rate limit on joinWithCode.
// ponytail: no per-user lockout; add one if join attempts ever show up in abuse logs.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const LENGTH = 12
export const JOIN_CODE_DAYS = 7

// Web Crypto, so this file also loads in the browser. 256 % 32 === 0, so `% 32` has no bias.
export const newJoinCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(LENGTH)), (b) => ALPHABET[b % ALPHABET.length]).join("")

/** "abcd-2345-wxyz " → "ABCD2345WXYZ", or null when it can't be a code. */
export function normalizeJoinCode(input: string) {
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, "")
  return code.length === LENGTH && [...code].every((c) => ALPHABET.includes(c)) ? code : null
}

/** Groups of four with dashes: also shapes a code as it's typed. */
export const formatJoinCode = (code: string) => code.match(/.{1,4}/g)?.join("-") ?? ""
