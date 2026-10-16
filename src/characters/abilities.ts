import type { Ability, AbilityScores } from "./character";

export const ABILITIES: readonly Ability[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']

export const STD_ARR: readonly number[] = [15, 14, 13, 12, 10, 8]

export const POINT_BUY_BUDGET = 27
export const POINT_BUY_MIN = 8
export const POINT_BUY_MAX = 15
export const ABILITY_CAP = 20
export const ORIGIN_TOTAL = 3
const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function formatModifier(modifier: number): string {
  return modifier < 0 ? `\u2212${Math.abs(modifier)}` : `+${modifier}`
}

export function pointBuySpent(base: Partial<AbilityScores>): number {
  let spent = 0
  for (const ability of ABILITIES) {
    const cost = POINT_BUY_COST[base[ability] ?? POINT_BUY_MIN]
    if (cost === undefined) return Infinity
    spent += cost
  }
  return spent
}

export function roll4d6DropLowest(rng: () => number = Math.random): number {
  const dice = Array.from({ length: 4 }, () => Math.floor(rng() * 6) + 1)
  return dice.reduce((sum, die) => sum + die, 0) - Math.min(...dice)
}

export function rollAbilityPool(rng: () => number = Math.random): number[] {
  return Array.from({ length: 6 }, () => roll4d6DropLowest(rng))
}

/** SRD2024 allows users to either use +2/+1 or +1/+1/+1 */
export function originSpreadValid(bonuses: Partial<AbilityScores>): boolean {
  const amounts = ABILITIES.map((ability) => bonuses[ability] ?? 0).filter((n) => n !== 0)
  if (amounts.reduce((sum, n) => sum + n, 0) !== ORIGIN_TOTAL) return false

  const sorted = [...amounts].sort((a, b) => b - a)
  return (
    (sorted.length === 2 && sorted[0] === 2 && sorted[1] === 1) ||
    (sorted.length === 3 && sorted.every((n) => n === 1))
  )
}

export function finalScores(
  base:Partial<AbilityScores>,
  originBonuses: Partial<AbilityScores>,
): Partial<AbilityScores> {
  const scores: Partial<AbilityScores> = {}
  for (const ability of ABILITIES) {
    const score = base[ability]
    if (score !== undefined) scores[ability] = score + (originBonuses[ability] ?? 0)
  }
  return scores
}

/** Proficiency bonuses, i.e. +2 at levels 1-4, +3 at 5-8, and so on. */
export function proficiencyBonus(level: number): number {
  return Math.floor((level - 1) / 4) + 2
}