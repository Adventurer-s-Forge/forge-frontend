import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getCollection } from "../lib/api";
import { seedCatalog } from "./catalog";
import { isBaseClass, toBackground, toClass, toItem, toRace } from "./normalize";
import type { RawBackground, RawClass, RawItem, RawRace } from "./normalize";
import { PageLoader } from "../components/PageLoader";

type State = { status: 'loading' } | { status: 'ready' } | { status: 'failed'; message: string }

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    
    async function load() {
      try {
        const [races, classes, backgrounds, items] = await Promise.all([
          getCollection<RawRace>('races'),
          getCollection<RawClass>('classes'),
          getCollection<RawBackground>('backgrounds'),
          getCollection<RawItem>('items'),
        ])

        if (cancelled) return

        if (races.length === 0 || classes.length === 0) {
          setState({
            status: 'failed',
            message: 'The content service is reachable but has no data loaded.',
          })
          return
        }

        seedCatalog({
          races: races.map(toRace),
          classes: classes.filter(isBaseClass).map(toClass),
          backgrounds: backgrounds.map(toBackground),
          items: items.map(toItem),
        })

        setState({ status: 'ready' })
      } catch (error) {
        if (cancelled) return
        setState({
          status: 'failed',
          message: error instanceof Error ? error.message : 'Could not load game content.',
        })
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') return <PageLoader />

  if (state.status === 'failed') {
    return (
      <main className="screen">
        <div className="card card-narrow">
          <p className="eyebrow">Content Unavailable</p>
          <h1>The Forge is cold.</h1>
          <p className="muted">{state.message}</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </main>
    )
  }

  return <>{children}</>
}