import type { CharacterClass } from "../data/catalog";
import { CHARACTER_TYPE_PRESETS, type Ability, type AbilityScores, type CharacterTypePreset } from "./character";
import { ABILITIES, abilityModifier, POINT_BUY_BUDGET, POINT_BUY_COST, POINT_BUY_MAX, POINT_BUY_MIN } from "./abilities";

export type Weights = AbilityScores

export type Recommendation = {
  base: AbilityScores
  bonuses: Partial<AbilityScores>
  spent: number
  value: number
}

const SCORES = Array.from({ length: POINT_BUY_MAX - POINT_BUY_MIN + 1 }, (_, i) => POINT_BUY_MIN + i)

export function classWeights(cls: Pick<CharacterClass, 'primaryAbilities' | 'savingThrows'>): Weights {
  const weight = (ability: Ability) =>
    cls.primaryAbilities.includes(ability) ? 3
    : cls.savingThrows.includes(ability) || ability === 'CON' ? 2
    : 1
  return Object.fromEntries(ABILITIES.map((ab) => [ab, weight(ab)])) as Weights
}

export function presetOptions(cls: Pick<CharacterClass, 'casterType'> | undefined): CharacterTypePreset[] {
  if (!cls) return []
  return CHARACTER_TYPE_PRESETS.filter((p) => p !== 'Caster' || cls.casterType !== 'NONE')
}

const PRESET_WEIGHTS: Record<CharacterTypePreset, { primary: number; listed: Partial<Weights> }> = {
  Tank: { primary: 1, listed: { STR: 3, CON: 3, DEX: 2 } },
  Striker: { primary: 3, listed: { DEX: 2, CON: 2} },
  Caster: { primary: 3, listed: { CON: 2, WIS: 2 } },
  'Skill-Focused': { primary: 1, listed: { DEX: 3, INT: 2, WIS: 2, CHA: 2 } },
}

export function presetWeight(cls: Pick<CharacterClass, 'primaryAbilities'>, preset: CharacterTypePreset): Weights {
  const { primary, listed } = PRESET_WEIGHTS[preset]
  const weight = (ability: Ability) => Math.max(listed[ability] ?? 1, cls.primaryAbilities.includes(ability) ? primary : 1)
  return Object.fromEntries(ABILITIES.map((ab) => [ab, weight(ab)])) as Weights
}

export function adviceWeights(
  cls: Pick<CharacterClass, 'primaryAbilities' | 'savingThrows'>,
  preset: CharacterTypePreset | null,
): Weights {
  return preset ? presetWeight(cls, preset) : classWeights(cls)
}

export function bonusPlacements(options: readonly Ability[]): Partial<AbilityScores>[] {
  const placements: Partial<AbilityScores>[] = []
  for (const two of options) {
    for (const one of options) {
      if (one !== two) placements.push({ [two]: 2, [one]: 1 })
    }
  }
  if (options.length === 3) placements.push(Object.fromEntries(options.map((ab) => [ab, 1])))
  return placements
}

/**
 * A cheaper base score that reaches the same modifier once `bonus` is added, or null if there is none.
 * A score with a cheaper twin wastes points, so the tip flags it and the optimiser never buys it.
 */
export function cheaperScore(score: number, bonus = 0): number | null {
  const modifier = abilityModifier(score + bonus)
  const cheapest = SCORES.find((s) => abilityModifier(s + bonus) === modifier)
  return cheapest !== undefined && cheapest < score ? cheapest : null
}

export const worthBuying = (bonus: number): number[] => SCORES.filter((sc) => cheaperScore(sc, bonus) === null)

/**
 * The best spread for one bonus placement. dp[i][p] is the best value the first i abilities can reach
 * spending exactly p points, or -Infinity if no spread costs exactly p. It must not be 0: an 8 is worth
 * -1, so a 0 would beat every real spread that holds one. pick[i][p] is the score ability i took to get
 * there, so the spread can be read back from the last row.
 */
function bestFor(weights: Weights, bonuses: Partial<AbilityScores>): Recommendation {
  const dp: number[][] = [Array.from({ length: POINT_BUY_BUDGET + 1 }, (_, p) => (p === 0 ? 0 : -Infinity))]
  const pick: number[][] = []

  ABILITIES.forEach((ab, i) => {
    const bonus = bonuses[ab] ?? 0
    const row = Array<number>(POINT_BUY_BUDGET + 1).fill(-Infinity)
    const picked = Array<number>(POINT_BUY_BUDGET + 1).fill(POINT_BUY_MIN)

    for (let p = 0; p <= POINT_BUY_BUDGET; p++) {
      for (const score of worthBuying(bonus)) {
        const before = p - POINT_BUY_COST[score]
        if (before < 0) continue

        const value = dp[i][before] + weights[ab] * abilityModifier(score + bonus)
        if (value > row[p]) {
          row[p] = value
          picked[p] = score
        }
      }
    }
    dp.push(row)
    pick.push(picked)
  })

  const last = dp[ABILITIES.length]
  let spent = 0
  for (let p = 1; p <= POINT_BUY_BUDGET; p++) if (last[p] > last[spent]) spent = p

  const base = {} as AbilityScores
  for (let i = ABILITIES.length - 1, p = spent; i >= 0; i--) {
    base[ABILITIES[i]] = pick[i][p]
    p -= POINT_BUY_COST[pick[i][p]]
  }
  return { base, bonuses, spent, value: last[spent] }
}

/**
 * The point-buy spread and bonus placement with the highest weighted total of modifiers.
 * Ties go to the cheaper spread, then the earlier placement, so the same inputs always get the same answer.
 * Null when the background offers no legal placement.
 */
export function recommend(weights: Weights, options: readonly Ability[]): Recommendation | null {
  let best: Recommendation | null = null
  for (const bonuses of bonusPlacements(options)) {
    const candidate = bestFor(weights, bonuses)
    if (
      best === null ||
      candidate.value > best.value ||
      (candidate.value === best.value && candidate.spent < best.spent)
    ) {
      best = candidate
    }
  }
  return best
}