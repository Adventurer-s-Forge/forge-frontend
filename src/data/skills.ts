import type { Ability } from "../characters/character";

export type Skill = {
  id: string
  name: string
  ability: Ability
}

export const SKILLS: readonly Skill[] = [
  { id: 'acrobatics', name: 'Acrobatics', ability: 'DEX'},
  { id: 'animal-handling', name: 'Animal Handling', ability: "WIS"},
  { id: 'arcana', name: 'Arcana', ability: 'INT'},
  { id: 'athletics', name: 'Athletics', ability: 'STR'},
  { id: 'deception', name: 'Deception', ability: 'CHA'},
  { id: 'history', name: 'History', ability: 'INT'},
  { id: 'insight', name: 'Insight', ability: 'WIS'},
  { id: 'intimidation', name: 'Intimidation', ability: 'CHA'},
  { id: 'investigation', name: 'Investigation', ability: 'INT'},
  { id: 'medicine', name: 'Medicine', ability: 'WIS'},
  { id: 'nature', name: 'Nature', ability: 'INT'},
  { id: 'perception', name: 'Perception', ability: 'WIS'},
  { id: 'performance', name: 'Performance', ability: 'CHA'},
  { id: 'persuasion', name: 'Persuasion', ability: 'CHA'},
  { id: 'religion', name: 'Religion', ability: 'INT'},
  { id: 'sleight-of-hand', name: 'Sleight of Hand', ability: 'DEX'},
  { id: 'stealth', name: 'Stealth', ability: 'DEX'},
  { id: 'survival', name: 'Survival', ability: 'WIS'},
]

const BY_NAME = new Map(SKILLS.map((skill) => [skill.name.toLowerCase(), skill.id]))

export function skillIdsFromNames(csv: string): string[] {
  return csv
    .split(',')
    .map((part) => BY_NAME.get(part.trim().toLowerCase()))
    .filter((id): id is string => id !== undefined)
}