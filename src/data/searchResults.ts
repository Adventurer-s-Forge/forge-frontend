/** /search answers with the same envelope the per-type collections use, but mixed:
 * one list can hold a race, a spell and a magic item. The normalizers each assume
 * their own shape and throw on anything else, so every conversion here is guarded
 * - a record the app cannot read degrates to an 'other' row instead of the whole
 * result list down with it. */

import type { Envelope } from "../lib/api";
import { catalog } from "./catalog";
import type { Background, CharacterClass, Equipment, Race, Skill, Spell } from "./catalog";
import { toBackground, toClass, toEquipment, toRace, toSkill, toSpell } from "./normalize";
import type { RawBackground, RawClass, RawEquipment, RawRace, RawSkill, RawSpell } from "./normalize";

export type HitKind =
  | 'race'
  | 'class'
  | 'background'
  | 'equipment'
  | 'spell'
  | 'skill'
  | 'other'

type HitMeta = {
  id: string
  key: string
  name: string
  document: string
  type: string
}

export type SearchHit = HitMeta &
  (
    | { kind: 'race'; value: Race }
    | { kind: 'class'; value: CharacterClass }
    | { kind: 'background'; value: Background }
    | { kind: 'equipment'; value: Equipment }
    | { kind: 'spell'; value: Spell }
    | { kind: 'skill'; value: Skill }
    | { kind: 'other'; value: null }
  )

/** The kinds that have a detail view. Monsters, magic items, and conditions are indexed
 * by the service but nothing at level 1 reads them, so they arrive as 'other', */
export const SEARCHABLE_KINDS: readonly { kind: HitKind; label: string }[] = [
  { kind: 'race', label: 'Races' },
  { kind: 'class', label: 'Classes' },
  { kind: 'background', label: 'Backgrounds' },
  { kind: 'equipment', label: 'Equipment' },
  { kind: 'spell', label: 'Spells' },
  { kind: 'skill', label: 'Skills' },
]

function meta(record: Envelope<unknown>): HitMeta {
  const raw = (record ?? {}) as Partial<Envelope<unknown>>
  const type = typeof raw.type === 'string' ? raw.type : 'unknown'
  const key = typeof raw.key === 'string' ? raw.key : ''
  
  return {
    id: `${type}:${key}`,
    key,
    name: typeof raw.name === 'string' ? raw.name : 'Unnamed entry',
    document: typeof raw.document === 'string' ? raw.document : '',
    type,
  }
}

function convert(record: Envelope<unknown>, base: HitMeta): SearchHit {
  switch (base.type) {
    case 'race':
      return { ...base, kind: 'race', value: toRace(record as Envelope<RawRace>) }

    case 'class': {
      const raw = record as Envelope<RawClass>
      const subclassOf: unknown = raw.data.subclass_of
      if (subclassOf !== null && subclassOf !== undefined) return { ...base, kind: 'other', value: null }
      return { ...base, kind: 'class', value: toClass(raw, catalog.equipment) }
    }

    case 'background':
      return {
        ...base,
        kind: 'background',
        value: toBackground(record as Envelope<RawBackground>, catalog.equipment, catalog.skills)
      }
      
    // Redis still holds orphaned ref:item:* recrods from an older type name.
    case 'equipment':
    case 'item':
      return { ...base, kind: 'equipment', value: toEquipment(record as Envelope<RawEquipment>) }

    case 'spell':
      return { ...base, kind: 'spell', value: toSpell(record as Envelope<RawSpell>) }

    case 'skill': {
      return { ...base, kind: 'skill', value: toSkill(record as Envelope<RawSkill>) }
    }

    default:
      return { ...base, kind: 'other', value: null}
  }
}

export function toSearchHit(record: Envelope<unknown>): SearchHit {
  const base = meta(record)

  try {
    return convert(record, base)
  } catch {
    return { ...base, kind: 'other', value: null }
  }
}

export const toSearchHits = (records: Envelope<unknown>[]): SearchHit[] =>
  (Array.isArray(records) ? records : []).map(toSearchHit)

export const hitsOfKind = (hits: SearchHit[], kind: HitKind | 'all'): SearchHit[] =>
  kind === 'all' ? hits : hits.filter((hit) => hit.kind === kind)

export function countsByKind(hits: SearchHit[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const hit of hits) counts[hit.kind] = (counts[hit.kind] ?? 0) + 1
  return counts
}