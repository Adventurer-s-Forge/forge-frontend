import { Link } from "react-router";
import { Wordmark } from "../components/Wordmark";
import { useAuth } from "../auth/useAuth";
import { useState } from "react";
import type { Mode } from "../components/LoginForm";
import { AuthModal } from "../components/AuthModal";
import { ThemeToggle } from "../components/Themetoggle";

const STD_ARR = [
  { key: 'STR', score: 15, mod: '+2' },
  { key: 'DEX', score: 14, mod: '+2' },
  { key: 'CON', score: 13, mod: '+1' },
  { key: 'INT', score: 12, mod: '+1' },
  { key: 'WIS', score: 10, mod: '+0' },
  { key: 'CHA', score: 8, mod: '\u22121' },
]

const FEATURES = [
  {
    title: 'Point buy, array, or the dice',
    body: "All three ability generation methods, with the 27-point budget and every modifier recalculating as you spend. Roll 4d6-drop-lower in the app if your table allows it. ",
  },
  {
    title: 'The arithmetic, handled',
    body: 'Proficiency bonus, saving throws, skill modifiers, armor class and spell slots all derive themselves from class and level. Change your race at step four and everything downstream follows.',
  },
  {
    title: 'Yours on any device',
    body: 'Characters save to your account, so the sheet you built on a laptop opens on a phone at the table. Sign in with email, Google, or GitHub.',
  },
]

export function Home() {
  const { user } = useAuth()
  const [authModal, setAuthModal] = useState<Mode | null>(null)

  function openAuth(mode: Mode) {
    return (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      setAuthModal(mode)
    }
  }

  return (
    <div className="site">
      <header className="site-header">
        <Wordmark />
        <nav className="site-nav">
          <ThemeToggle />
          {user ? (
           <Link className="btn btn-primary" to="/dashboard">
            Go to dashboard
           </Link> 
          ) : (
            <>
              <Link className="btn btn-quiet" to="/login" onClick={openAuth('signin')}>
                Sign in
              </Link>
              <Link className="btn btn-primary" to="/login?mode=signup" onClick={openAuth('signup')}>
                Create account
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Dungeons &amp; Dragons 5th edition</p>
            <h1>Roll a character in minutes, not evenings.</h1>
            <p className="hero-sub">
              Adventurer's Forge walks you through race, class, background and abilities, does every calculation behind the sheet,
              and hands you a character that's ready for session one.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg" to={user ? '/dashboard' : '/login'} onClick={user ? undefined : openAuth('signin')}>
                {user ? 'Open your characters' : 'Start building - free'}
              </Link>
              <span className="hero-note">No card. One character, no limits.</span>
            </div>
          </div>

          <figure className="statblock-frame">
            <figcaption className="statblock-caption">
              <span>Ability scores</span>
              <span className="statblock-method">Standard array</span>
            </figcaption>
            <div className="statblock">
              {STD_ARR.map((ability) => (
                <div className="stat" key={ability.key}>
                  <span className="stat-key">{ability.key}</span>
                  <span className="stat-score">{ability.score}</span>
                  <span className="stat-mod">{ability.mod}</span>
                </div>
              ))}
            </div>
            <p className="statblock-foot">
              Swap to point buy or 4d6 drop lowest at any time
            </p>
          </figure>
        </section>

        <section className="features">
          {FEATURES.map((feature) => (
            <article className="feature" key={feature.title}>
              <h2>{feature.title}</h2>
              <p>{feature.body}</p>
            </article>
          ))}
        </section>

        <section className="closer">
          <h2>Your first character is twenty minutes away.</h2>
          <Link className="btn btn-primary btn-lg" to={user ? '/dashboard' : '/login?mode=signup'} onClick={user ? undefined : openAuth('signup')}>
            {user ? 'Create your character' : 'Sign up to create your character'}
          </Link>
        </section>
      </main>

      <footer className="site-footer">
        <span>Adventurer's Forge</span>
        <span className="muted">
          Unofficial. Not affiliated with Wizards of the Coast.
        </span>
      </footer>

      {authModal && <AuthModal initialMode={authModal} onClose={() => setAuthModal(null)} />}
    </div>
  )
}