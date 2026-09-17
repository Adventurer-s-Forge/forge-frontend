import type { Ability, AbilityScores } from "./character";
import type { Race } from "../data/catalog";

export const ABILITIES: readonly Ability[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']

export const STD_ARR: readonly number[] = [15, 14, 13, 12, 10, 8]

export const POINT_BUY_BUDGET = 27
export const POINT_BUY_MIN = 8
export const POINT_BUY_MAX = 15
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

export function racialBonuses(race: Race | undefined, choices: readonly Ability[]): Partial<AbilityScores> {
  const bonuses: Partial<AbilityScores> = { ...race?.abilityBonuses }
  if (race?.abilityChoice) {
    for (const ability of choices) {
      bonuses[ability] = (bonuses[ability] ?? 0) + race.abilityChoice.amount
    }
  }
  return bonuses
}

export function finalScores(
  base:Partial<AbilityScores>,
  race: Race | undefined,
  choices: readonly Ability[],
): Partial<AbilityScores> {
  const bonuses = racialBonuses(race, choices)
  const scores: Partial<AbilityScores> = {}
  for (const ability of ABILITIES) {
    const score = base[ability]
    if (score !== undefined) scores[ability] = score + (bonuses[ability] ?? 0)
  }
  return scores
}