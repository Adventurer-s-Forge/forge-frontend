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

      <p className="attribution-sources" aria-label="UI attribution">
        This work bases its User Interface (UI) off of the following sources:
        <ul>
          <li>The <em>v2.1 sheet</em> [Google Sheet template file] created by Evans, F. (n.d.).</li>
          <li>The <a href="https://sw5e.com/tools/mycharacter">SW5e Character Creator</a> created by Galiphile [Username]., et al. (n.d.).</li>
        </ul>
      </p>
      
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