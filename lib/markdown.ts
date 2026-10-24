// Markdown → one line of plain text, for previews (task cards). Not a parser: drops the syntax <RichText> writes.
export function plainText(md: string) {
  return md
    .replace(/```[^\n]*\n?/g, "") // code fences
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → their text
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+(\[[ xX]\]\s+)?|\d+\.\s+)/gm, "") // headings, quotes, list and checklist markers
    .replace(/^\s*(-{3,}|\*{3,})\s*$/gm, "") // dividers
    .replace(/(?<!\\)(\*\*|__|~~|`|\*|_)(\S(?:.*?[^\s\\])?)\1/g, "$2") // bold, italic, strike, code
    .replace(/\\([\\`*_{}[\]()#+\-.!~>])/g, "$1") // escapes
    .replace(/&nbsp;/g, " ") // empty lines
    .replace(/\s+/g, " ")
    .trim()
}
