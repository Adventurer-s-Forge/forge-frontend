import { useEffect, useRef, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";
import { ApiError, SEARCH_PG_SIZE, searchAllRef } from "../lib/api";
import { SEARCHABLE_KINDS, countsByKind, hitsOfKind, toSearchHits } from "../data/searchResults";
import type { HitKind, SearchHit } from "../data/searchResults";
import { formatCoins } from "../characters/currency";
import { Markdown } from "./Markdown";

const DEBOUNCE_MS = 280
const MIN_QUERY = 2

type Result = {
  term: string
  hits: SearchHit[]
  capped: boolean
  error: string | null
}

const NOTHING: Result = { term: '', hits: [], capped: false, error: null }

function useDebounced(value: string, ms: number): string {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])

  return settled
}

const KIND_LABEL: Record<HitKind, string> = {
  race: 'Race',
  class: 'Class',
  background: 'Background',
  equipment: 'Equipment',
  spell: 'Spell',
  skill: 'Skill',
  other: 'Reference',
}

const spellLevel = (level: number) => (level === 0 ? 'Cantrip' : `Level ${level}`)

function Facts({ rows }: { rows: [string, string][] }) {
  const shown = rows.filter(([, value]) => value !== '')
  if (shown.length === 0) return null

  return (
    <dl className="trait-list">
      {shown.map(([term, value]) => (
        <div className="trait-row" key={term}>
          <dt className="trait-term">{term}</dt>
          <dd className="trait-desc">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function HitDetail( { hit }: { hit: SearchHit }) {
  switch (hit.kind) {
    case 'race':
      return (
        <>
          <Facts
            rows={[
              ['Size', hit.value.sizes.join(' or ')],
              ['Speed', `${hit.value.speed} feet`],
              ['Darkvision', hit.value.darkvisionFt ? `${hit.value.darkvisionFt} feet` : 'None'],
            ]}
          />
          {hit.value.traits.map((trait) => (
            <div className="trait-card" key={trait.name}>
              <p className="detail-eyebrow">{trait.name}</p>
              <Markdown source={trait.desc} />
            </div>  
          ))}
        </>
      )

    case 'class':
      return (
        <>
          <Facts
            rows={[
              ['Hit die', `d${hit.value.hitDie}`],
              ['Primary ability', hit.value.primaryAbilityText],
              ['Saving throws', hit.value.savingThrows.join(', ')],
              ['Armor training', hit.value.proficiencies.armor],
              ['Weapons', hit.value.proficiencies.weapons],
              ['Spellcasting', hit.value.casterType === 'NONE' ? 'None' : hit.value.casterType],
            ]}
          />
          {hit.value.features.map((feat) => (
            <div className="trait-card" key={feat.name}>
              <p className="detail-eyebrow">{feat.name}</p>
              <Markdown source={feat.desc} />
            </div>
          ))}
        </>
      )

    case 'background':
      return (
        <Facts
          rows={[
            ['Skills', hit.value.skillIds.join(', ')],
            ['Ability scores', hit.value.abilityOptions.join(', ')],
            ['Feat', hit.value.featName],
            ['Tool', hit.value.tool.text],
          ]}
        />
      )

    case 'equipment':
      return (
        <>
          <Facts
            rows={[
              ['Category', hit.value.category],
              ['Cost', hit.value.costCp > 0 ? formatCoins(hit.value.costCp) : 'No listed price'],
              ['Base AC', hit.value.armor ? String(hit.value.armor.base) : ''],
            ]}
          />
          {hit.value.desc && <Markdown source={hit.value.desc} />}
        </>
      )

    case 'spell':
      return (
        <>
          <Facts
            rows={[
              ['Level', spellLevel(hit.value.level)],
              ['School', hit.value.school],
              ['Casting time', hit.value.castingTime],
              ['Range', hit.value.range],
              ['Duration', hit.value.duration],
              ['Tags', [hit.value.concentration && 'Concentration', hit.value.ritual && 'Ritual'].filter(Boolean).join(', ')],
            ]}
          />
          <Markdown source={hit.value.desc} />
        </>
      )

    case 'skill':
      return <Facts rows={[['Ability', hit.value.ability]]} />

    case 'other':
      return (
        <p className="step-hint">
          The Forge indexes this entry but has no detail view for a {hit.type.replace('_', ' ')} yet.
        </p>
      )
  }
}

export function SearchPanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<HitKind | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [result, setResult] = useState<Result>(NOTHING)

  const term = useDebounced(query.trim(), DEBOUNCE_MS)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  useEffect(() => {
    if (term.length < MIN_QUERY) return

    let canxd = false

    searchAllRef(term).then((records) => {
      if (canxd) return
      setResult({ term, hits: toSearchHits(records), capped: records.length === SEARCH_PG_SIZE, error: null })
    }).catch((err: unknown) => {
      if (canxd) return
      setResult({ term, hits: [], capped: false, error: err instanceof ApiError ? err.message : 'That search could not be completed' })
    })

    return () => {
      canxd = true
    }
  }, [term])

  const tooShort = term.length < MIN_QUERY
  const searching = !tooShort && result.term !== term

  // The prev answer stays on screen while the next on is in flight.
  const hits = tooShort ? [] : result.hits
  const counts = countsByKind(hits)

  // A filter that has nothing left in it relaxes itself rather than showing an empty list.
  const activeKind = kind !== 'all' && (counts[kind] ?? 0) === 0 ? 'all' : kind
  const shown = hitsOfKind(hits, activeKind)

  // Dervied, so a result list that no longer holds the selection simply clears it.
  const selected = shown.find((hit) => hit.id === selectedId) ?? null
  const error = tooShort ? null : result.error

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-wide"
      aria-label="Browse game content"
      onCancel={(e) => {e.preventDefault(); onClose()}}
      onClick={(e) => {if (e.target === dialogRef.current) onClose()}}
    >
      <div className="modal-panel wizard">
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          <FiX size={16} />
        </button>

        <header className="wizard-head">
          <h2>Browse content</h2>
          <p className="wizard-sub">
            Races, classes, backgrounds, equipment, spells, and skills. Straight from the content service.
            Nothing here changes your character.
          </p>
        </header>

        <div className="search-controls">
          <div className="shop-search">
            <label htmlFor="content-query" aria-label="Search content">
              <FiSearch size={15} aria-hidden="true" />
            </label>
            <input
              id="content-query"
              type="search"
              value={query}
              autoFocus
              placeholder="longsword, fireball, dwarf&hellip;"
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="shop-count" aria-live="polite">
              {searching ? 'Searching\u2026' : `${shown.length} shown`}
            </span>
          </div>

          <div className="chip-row" role="group" aria-label="Filter by content type">
            <button
              type="button"
              className={`chip${activeKind === 'all' ? ' is-chosen' : ''}`}
              aria-pressed={activeKind === 'all'}
              onClick={() => setKind('all')}
            >
              Everything
              {hits.length > 0 && <span className="chip-meta">{hits.length}</span>}
            </button>

            {SEARCHABLE_KINDS.map(({ kind: option, label }) => (
              <button
                type="button"
                className={`chip${activeKind === option ? ' is-chosen' : ''}`}
                key={option}
                aria-pressed={activeKind === option}
                disabled={(counts[option] ?? 0) === 0}
                onClick={() => setKind(option)}
              >
                {label}
                {(counts[option] ?? 0) > 0 && <span className="chip-meta">{counts[option]}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="wizard-panel search-body">
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          {!tooShort && result.capped && (
            <p className="notice">
              Showing the first {SEARCH_PG_SIZE} matches. Narrow the search to see the rest.
            </p>
          )}

          {tooShort ? (
            <p className="step-hint">Type at least {MIN_QUERY} letters to search.</p> 
          ) : !searching && shown.length === 0 ? (
            <p className="step-hint">Nothing matches &ldquo;{term}&rdquo;.</p>
          ) : (
            <div className="search-split">
              <div className="search-results">
                <ul className="option-list search-list">
                  {shown.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        className={`option${hit.id === selectedId ? ' is-chosen': ''}`}
                        aria-pressed={hit.id === selectedId}
                        onClick={() => setSelectedId(hit.id)}
                      >
                        <span className="option-name">{hit.name}</span>
                        <span className="option-meta">{KIND_LABEL[hit.kind]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <aside className="search-detail">
                {selected === null ? (
                  <p className="step-hint">Pick a result to read it.</p>
                ) : (
                  <section className="detail-panel" aria-labelledby="search-detail-title">
                    <div className="detail-head">
                      <div>
                        <p className="detail-eyebrow">{KIND_LABEL[selected.kind]}</p>
                        <h3 className="detail-title" id="search-detail-title">
                          {selected.name}
                        </h3>
                      </div>
                    </div>

                    <HitDetail hit={selected} />

                    {selected.document && (
                      <div className="detail-foot">
                        <span className="detail-eyebrow">Source</span>
                        <span className="foot-chip">
                          <span className="foot-chip-tag">{selected.document}</span>
                          {selected.key}
                        </span>
                      </div>
                    )}
                  </section>
                )}
              </aside>
            </div>
          )}
        </div>
      </div>
    </dialog>
  )
}
