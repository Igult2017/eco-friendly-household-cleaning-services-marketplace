import React from "react"

// Minimal, dependency-free Markdown renderer for the legal pages. Handles the subset the drafts use:
// #..#### headings, > blockquotes, -/* and 1. lists, --- rules, | tables |, and inline **bold**,
// `code`, [text](url), plus [[NEEDS: …]] placeholders (rendered as a visible amber "to complete" mark).

function inline(text: string, k: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /(\[\[NEEDS:[^\]]*\]\]|\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0, m: RegExpExecArray | null, i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith("[[NEEDS")) {
      out.push(<mark key={`${k}-${i}`} className="bg-amber-100 text-amber-900 rounded px-1 text-[0.92em] font-medium">⚠ {tok.replace(/^\[\[NEEDS:\s*/, "").replace(/\]\]$/, "")}</mark>)
    } else if (tok.startsWith("**")) {
      out.push(<strong key={`${k}-${i}`} className="font-semibold text-[#2B3441]">{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith("`")) {
      out.push(<code key={`${k}-${i}`} className="font-mono text-xs bg-gray-100 rounded px-1">{tok.slice(1, -1)}</code>)
    } else {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)
      if (lm) out.push(<a key={`${k}-${i}`} href={lm[2]} className="text-[#2D7A5F] underline">{lm[1]}</a>)
    }
    last = m.index + tok.length; i++
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function LegalMarkdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n")
  const blocks: React.ReactNode[] = []
  let i = 0, key = 0
  let para: string[] = []
  const flush = () => { if (para.length) { blocks.push(<p key={key++} className="leading-relaxed">{inline(para.join(" "), `p${key}`)}</p>); para = [] } }

  while (i < lines.length) {
    const t = lines[i].trim()
    if (!t) { flush(); i++; continue }
    let mh: RegExpExecArray | null
    if ((mh = /^(#{1,4})\s+(.*)$/.exec(t))) {
      flush()
      const lvl = mh[1].length, txt = mh[2]
      const cls = lvl === 1 ? "font-serif text-4xl font-bold text-[#2B3441] mb-2"
        : lvl === 2 ? "font-serif text-2xl font-bold text-[#2B3441] mt-10 mb-3"
        : lvl === 3 ? "text-lg font-semibold text-[#2B3441] mt-6 mb-2"
        : "text-base font-semibold text-[#2B3441] mt-4 mb-1"
      const H = (lvl === 1 ? "h1" : lvl === 2 ? "h2" : lvl === 3 ? "h3" : "h4") as React.ElementType
      blocks.push(<H key={key++} className={cls}>{inline(txt, `h${key}`)}</H>)
      i++; continue
    }
    if (/^>\s?/.test(t)) {
      flush()
      const q: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) { q.push(lines[i].trim().replace(/^>\s?/, "")); i++ }
      blocks.push(<blockquote key={key++} className="border-l-4 border-[#4CB87A] bg-[#F4FAF6] pl-4 py-2 my-4 text-[#2B3441]/90">{inline(q.join(" "), `q${key}`)}</blockquote>)
      continue
    }
    if (/^[-*]\s+/.test(t)) {
      flush()
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-*]\s+/, "")); i++ }
      blocks.push(<ul key={key++} className="list-disc pl-6 space-y-1 my-3">{items.map((it, j) => <li key={j}>{inline(it, `li${key}-${j}`)}</li>)}</ul>)
      continue
    }
    if (/^\d+\.\s+/.test(t)) {
      flush()
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+\.\s+/, "")); i++ }
      blocks.push(<ol key={key++} className="list-decimal pl-6 space-y-1 my-3">{items.map((it, j) => <li key={j}>{inline(it, `ol${key}-${j}`)}</li>)}</ol>)
      continue
    }
    if (/^---+$/.test(t)) { flush(); blocks.push(<hr key={key++} className="my-8 border-[#E5EBF0]" />); i++; continue }
    if (/^\|.*\|$/.test(t)) {
      flush()
      const rows: string[] = []
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) { rows.push(lines[i].trim()); i++ }
      const cells = (r: string) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim())
      const sep = rows[1] && /^[-:\s|]+$/.test(rows[1].replace(/\|/g, ""))
      const head = cells(rows[0]); const body = rows.slice(sep ? 2 : 1).map(cells)
      blocks.push(
        <div key={key++} className="overflow-x-auto my-4">
          <table className="w-full text-xs border-collapse">
            <thead><tr className="bg-[#F8FAFB]">{head.map((h, j) => <th key={j} className="text-left px-2 py-1.5 border border-[#E5EBF0] font-semibold text-[#2B3441]">{inline(h, `th${key}-${j}`)}</th>)}</tr></thead>
            <tbody>{body.map((row, r) => <tr key={r}>{row.map((c, j) => <td key={j} className="px-2 py-1.5 border border-[#E5EBF0] align-top">{inline(c, `td${key}-${r}-${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )
      continue
    }
    para.push(t); i++
  }
  flush()
  return <div className="space-y-2 text-sm text-[#2B3441]/85">{blocks}</div>
}
