import type { ReactNode } from "react";

/** Upstream SRD prose is markdown, but only ever uses five constructs: paragraphs, bullet lists, bold
 * italics and pipe tables. Parsing that subset into React note avoids both a dependency and innerHTML.
 * The pipe tables in the source are unevenly spaced, so cells are trimmed.  */

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*)/g
const BULLET = /^\s*[-+]\s+/

function inline(text: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter(Boolean)
    .map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i}>{part.slice(1, -1)}</em>
      }
      return part
    })
}

const cells = (line: string) =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())

const isDivider = (line: string) => cells(line).every((cell) => /^:?-{2,}:?$/.test(cell))

/** A wrapped bullet continues the item above it rather than starting a new one */
function listItems(lines: string[]): string[] {
  const items: string[] = []
  for (const line of lines) {
    if (BULLET.test(line)) items.push(line.replace(BULLET, ''))
      else if (items.length > 0) items[items.length - 1] += ` ${line.trim()}`
  }
  return items
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = source.trim().split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean)

  return (
    <div className={className ? `md ${className}` : 'md'}>
      {blocks.map((block, index) => {
        const lines = block.split('\n')

        if (lines.length > 1 && lines[0].trim().startsWith('|')) {
          const [head, ...body] = lines.filter((line) => !isDivider(line)).map(cells)

          return (
            <div className="md-table-wrap" key={index}>
              <table className="md-table">
                <thead>
                  <tr>
                    {head.map((cell, i) => (
                      <th key={i}>{inline(cell)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, i) => (
                        <td key={i}>{inline(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        if (BULLET.test(lines[0])) {
          return (
            <ul className="md-list" key={index}>
              {listItems(lines).map((item, i) => (
                <li key={i}>{inline(item)}</li>
              ))}
            </ul>
          )
        }

        if (/^Table:\s/.test(block)) {
          return (
            <p className="md-caption" key={index}>
              {block.replace(/^Table:\s*/, ' ')}
            </p>
          )
        }

        return (
          <p className="md-text" key={index}>
            {inline(block.replace(/\n/g, ' '))}
          </p>
        )
      })}
    </div>
  )
}