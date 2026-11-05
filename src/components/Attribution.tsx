import { Link } from "react-router";
import { catalog } from "../data/catalog";
import type { Source } from "../data/catalog";

const UNSTATED = 'a license the content service does not state'

function SourceCredit({ source }: { source: Source }) {
  return (
    <li>
      This work includes material from{' '}
      {source.permalink ? (
        <a href={source.permalink} target="_blank" rel="noreferrer">
          {source.name}
        </a>
      ) : (
        source.name
      )}
      {source.publisher && ` by ${source.publisher}`}, used without modification under{' '}
      {source.license ? (
        <a href={source.license.url} target="_blank" rel="noreferrer">
          {source.license.name}
        </a>
      ) : (
        UNSTATED
      )}
      .
    </li>
  )
}

export function AttributionNotice() {
  return (
    <section className="attribution" aria-label="Content attribution">
      <ul className="attribution-sources">
        {catalog.sources.map((source) => (
          <SourceCredit key={source.key} source={source} />
        ))}
      </ul>

      <p className="attribution-credit">
        Adventurer&rsquo;s Forge is an academic project completed by Penn State Graduate Students.
        This is unofficial and is not affiliated with, endorsed by, or sponsored by any publisher
        named here.
      </p>
    </section>
  )
}

export function AttributionLink() {
  return (
    <footer className="site-footer">
      <span className="muted">Adventurer&rsquo;s Forge &middot; unofficial</span>
      <Link to="/attribution">Attribution &amp; licenses</Link>
    </footer>
  )
}