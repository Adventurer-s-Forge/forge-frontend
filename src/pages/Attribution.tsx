import { Link } from "react-router";
import { Wordmark } from "../components/Wordmark";
import { ThemeToggle } from "../components/Themetoggle";
import { AttributionNotice } from "../components/Attribution";

export function Attribution() {
  return (
    <div className="site">
      <header className="site-header">
        <Wordmark />
        <nav className="site-nav">
          <ThemeToggle />
          <Link className="btn btn-quiet" to="/">
            Home
          </Link>
        </nav>
      </header>

      <main className="app-main">
        <div className="card card-prose">
          <p className="eyebrow">Attribution</p>
          <h1>Where the game content comes from</h1>
          <p className="muted">
            Every race, class, background, spell, item and skill in the Forge is read from a content
            service when the app loads. Nothing has been altered, and nothing is reproduced beyond
            what each source&rsquo;s license permits.
          </p>

          <AttributionNotice />
        </div>
      </main>
    </div>
  )
}