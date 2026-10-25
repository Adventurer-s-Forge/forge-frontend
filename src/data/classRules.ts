import type { Ability } from "../characters/character";

export const classKey = (id: string) => id.replace(/^[^_]*_/, '')

export const CLASS_SKILL_CHOICES: Record<string, { count: number; from: string[] | 'any' }> = {
  barbarian: { count: 2, from: ['animal-handling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] },
  bard: { count: 3, from: 'any' },
  cleric: { count: 2, from: ['history', 'insight', 'medicine', 'persuasion', 'religion'] },
  druid: { count: 2, from: ['arcana', 'animal-handling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
  fighter: { count: 2, from: ['acrobatics', 'animal-handling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'] },
  monk: { count: 2, from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] },
  paladin: { count: 2, from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] },
  ranger: { count: 3, from: ['animal-handling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] },
  rogue: { count: 4, from: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleight-of-hand', 'stealth'] },
  sorcerer: { count: 2, from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'] },
  warlock: { count: 2, from: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'] },
  wizard: { count: 2, from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'] },
}

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

/** This is here for now as a placeholder until backend ingests /feats from Open5e */
export const FIGHTING_STYLES = [
  { id: 'archery', name: 'Archery', note: '+2 to attack rolls with ranged weapons.' },
  { id: 'defense', name: 'Defense', note: '+1 AC while wearing armor.' },
  { id: 'dueling', name: 'Dueling', note: '+2 damage with a single one-handed weapon.' },
  { id: 'great-weapon-fighting', name: 'Great Weapon Fighting', note: 'Reroll low damage dice with two-handed weapons.' },
  { id: 'protection', name: 'Protection', note: 'Impose disadvantage on an attack against a nearby ally.' },
  { id: 'two-weapon-fighting', name: 'Two-Weapon Fighting', note: 'Add your ability modifier to the second attack.' },
] as const

export const fightingStyleName = (id: string | null) => FIGHTING_STYLES.find((style) => style.id === id)?.name ?? null