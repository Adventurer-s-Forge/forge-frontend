import type { Ability } from "../characters/character";

export const classKey = (id: string) => id.replace(/^[^_]*_/, '')

export const SPELLCASTING_ABILITY: Record<string, Ability> = {
  bard: 'CHA',
  cleric: 'WIS',
  druid: 'WIS',
  paladin: 'CHA',
  ranger: 'WIS',
  sorcerer: 'CHA',
  warlock: 'CHA',
  wizard: 'INT',
}
