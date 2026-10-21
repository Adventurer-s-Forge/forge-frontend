import type { Size, EquipmentPick } from "../data/catalog"

export type Ability = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'
export type AbilityScores = Record<Ability, number>
export type AbilityMethod = 'standard' | 'pointbuy' | 'roll'

export type StepId = 'name' | 'race' | 'class' | 'background' | 'attributes' | 'skills' | 'spells' | 'equipment'

export const STEPS: readonly { id: StepId; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'race', label: 'Race' },
  { id: 'class', label: 'Class' },
  { id: 'background', label: 'Background' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'attributes', label: 'Attributes' },
  { id: 'skills', label: 'Skills' },
  { id: 'spells', label: 'Spells' },
]

export type Character = {
  id: string
  name: string
  level: number
  raceId: string | null
  sizeChoice: Size | null
  classId: string | null
  fightingStyleId: string | null
  backgroundId: string | null
  abilities: {
    method: AbilityMethod | null
    base: Partial<AbilityScores>
    rolled: number[]
    originBonuses: Partial<AbilityScores> /** Changed naming convention for SRD2024 */
  }
  proficientSkillIds: string[]
  expertiseIds: string[]
  spellIds: string[]
  equipmentChoice: { class: EquipmentPick | null; background: EquipmentPick | null }
  purchasedItemIds: string[]
  walletCp: number
  completedSteps: StepId[]
  createdAt: string
  updatedAt: string
}

export function createDraft(): Character {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: '',
    level: 1,
    raceId: null,
    sizeChoice: null,
    classId: null,
    fightingStyleId: null,
    backgroundId: null,
    abilities: { method: null, base: {}, rolled: [], originBonuses: {} },
    proficientSkillIds: [],
    expertiseIds: [],
    spellIds: [],
    equipmentChoice: { class: null, background: null },
    purchasedItemIds: [],
    walletCp: 0,
    completedSteps: [],
    createdAt: now,
    updatedAt: now,
  }
}