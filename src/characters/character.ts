export type Ability = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'
export type AbilityScores = Record<Ability, number>
export type AbilityMethod = 'standard' | 'pointbuy' | 'roll'

export type StepId = 'name' | 'race' | 'class' | 'background' | 'attributes' | 'skills' | 'equipment'

export const STEPS: readonly { id: StepId; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'race', label: 'Race' },
  { id: 'class', label: 'Class' },
  { id: 'background', label: 'Background' },
  { id: 'attributes', label: 'Attributes' },
  { id: 'skills', label: 'Skills' },
  { id: 'equipment', label: 'Equipment' },
]

export type Character = {
  id: string
  name: string
  raceId: string | null
  classId: string | null
  backgroundId: string | null
  abilities: {
    method: AbilityMethod | null
    base: Partial<AbilityScores>
    rolled: number[]
    racialChoices: Ability[]
  }
  skillIds: string[]
  equipmentIds: string[]
  completedSteps: StepId[]
  createdAt: string
  updatedAt: string
}

export function createDraft(): Character {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: '',
    raceId: null,
    classId: null,
    backgroundId: null,
    abilities: { method: null, base: {}, rolled: [], racialChoices: [] },
    skillIds: [],
    equipmentIds: [],
    completedSteps: [],
    createdAt: now,
    updatedAt: now,
  }
}