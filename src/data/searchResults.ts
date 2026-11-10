/** /search answers with the same envelope the per-type collections use, but mixed:
 * one list can hold a race, a spell and a magic item. The normalizers each assume
 * their own shape and throw on anything else, so every conversion here is guarded
 * - a record the app cannot read degrates to an 'other' row instead of the whole
 * result list down with it. */

import type { Envelope, RefType } from "../lib/api";
import { catalog } from "./catalog";
import type { Background, CharacterClass, Equipment, Race, Skill, Spell, Subclass } from "./catalog";
import { toBackground, toClass, toEquipment, toRace, toSkill, toSpell, toSubclass } from "./normalize";
import type { RawBackground, RawClass, RawEquipment, RawRace, RawSkill, RawSpell } from "./normalize";
import { toCond, toFeat, toMagicItem, toMonster, type Condition, type Feat, type MagicItem, type Monster, type RawCond, type RawFeat, type RawMagicItem, type RawMonster } from "./reference";

export type HitKind =
  | 'race'
  | 'class'
  | 'subclass'
  | 'background'
  | 'equipment'
  | 'spell'
  | 'skill'
  | 'feat'
  | 'monster'
  | 'magic_item'
  | 'condition'
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
    | { kind: 'subclass'; value: Subclass }
    | { kind: 'background'; value: Background }
    | { kind: 'equipment'; value: Equipment }
    | { kind: 'spell'; value: Spell }
    | { kind: 'skill'; value: Skill }
    | { kind: 'feat'; value: Feat }
    | { kind: 'monster'; value: Monster }
    | { kind: 'magic_item'; value: MagicItem }
    | { kind: 'condition'; value: Condition }
    | { kind: 'other'; value: null }
  )

/** The chips whose numbers the service can supply: the hit kinds whose name is also a
 * /search reference type. A subclass folds into `class`, so all ten line up with `counts`. */
export type ChipKind = HitKind & RefType

export const SEARCHABLE_KINDS: readonly { kind: ChipKind; label: string }[] = [
  { kind: 'race', label: 'Races' },
  { kind: 'class', label: 'Classes' },
  { kind: 'background', label: 'Backgrounds' },
  { kind: 'equipment', label: 'Equipment' },
  { kind: 'spell', label: 'Spells' },
  { kind: 'skill', label: 'Skills' },
  { kind: 'feat', label: 'Feats' },
  { kind: 'monster', label: 'Monsters' },
  { kind: 'magic_item', label: 'Magic items' },
  { kind: 'condition', label: 'Conditions' },
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
      if (raw.data.subclass_of) return { ...base, kind: 'subclass', value: toSubclass(raw) }
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

    case 'skill':
      return { ...base, kind: 'skill', value: toSkill(record as Envelope<RawSkill>) }

    case 'feat':
      return { ...base, kind: 'feat', value: toFeat(record as Envelope<RawFeat>) }

    case 'monster':
      return { ...base, kind: 'monster', value: toMonster(record as Envelope<RawMonster>) }

    case 'magic_item':
      return { ...base, kind: 'magic_item', value: toMagicItem(record as Envelope<RawMagicItem>) }

    case 'condition':
      return { ...base, kind: 'condition', value: toCond(record as Envelope<RawCond>) }

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

/** A subclass is a class, so it coutns and filters under the Classes chip. Keeping it a 
 * distinct kind is only so the row meta and the detail view can tell them apart. */
const CHIP_KIND: Partial<Record<HitKind, HitKind>> = { subclass: 'class' }

const chipKind = (kind: HitKind): HitKind => CHIP_KIND[kind] ?? kind

export const hitsOfKind = (hits: SearchHit[], kind: HitKind | 'all'): SearchHit[] =>
  kind === 'all' ? hits : hits.filter((hit) => chipKind(hit.kind) === kind)