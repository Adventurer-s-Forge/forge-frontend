import { describe, expect, it } from 'vitest'
import type { Ability, AbilityScores } from '../characters/character'
import {
  ABILITIES,
  abilityModifier,
  originSpreadValid,
  POINT_BUY_BUDGET,
  POINT_BUY_COST,
  pointBuySpent,
} from '../characters/abilities'
import {
  adviceWeights,
  bonusPlacements,
  cheaperScore,
  classWeights,
  presetOptions,
  presetWeight,
  recommend,
  worthBuying,
  type Weights,
} from '../characters/optimizer'

/** The twelve SRD 2024 classes: primary abilities, then saving throws. */
const CLASSES: Record<string, { primaryAbilities: Ability[]; savingThrows: Ability[] }> = {
  Barbarian: { primaryAbilities: ['STR'], savingThrows: ['STR', 'CON'] },
  Bard: { primaryAbilities: ['CHA'], savingThrows: ['DEX', 'CHA'] },
  Cleric: { primaryAbilities: ['WIS'], savingThrows: ['WIS', 'CHA'] },
  Druid: { primaryAbilities: ['WIS'], savingThrows: ['INT', 'WIS'] },
  Fighter: { primaryAbilities: ['STR', 'DEX'], savingThrows: ['STR', 'CON'] },
  Monk: { primaryAbilities: ['DEX', 'WIS'], savingThrows: ['STR', 'DEX'] },
  Paladin: { primaryAbilities: ['STR', 'CHA'], savingThrows: ['WIS', 'CHA'] },
  Ranger: { primaryAbilities: ['DEX', 'WIS'], savingThrows: ['STR', 'DEX'] },
  Rogue: { primaryAbilities: ['DEX'], savingThrows: ['DEX', 'INT'] },
  Sorcerer: { primaryAbilities: ['CHA'], savingThrows: ['CON', 'CHA'] },
  Warlock: { primaryAbilities: ['CHA'], savingThrows: ['WIS', 'CHA'] },
  Wizard: { primaryAbilities: ['INT'], savingThrows: ['INT', 'WIS'] },
}

/** The four SRD 2024 backgrounds and the abilities each lets the player raise. */
const BACKGROUNDS: Record<string, Ability[]> = {
  Acolyte: ['INT', 'WIS', 'CHA'],
  Criminal: ['DEX', 'CON', 'INT'],
  Sage: ['CON', 'INT', 'WIS'],
  Soldier: ['STR', 'DEX', 'CON'],
}

/**
 * The true optimum, found the slow way: every combination of 8 to 15 across the six abilities, under every
 * bonus placement the app's own rule accepts. Shares nothing with the optimiser but the cost table.
 * Returns the best value and the fewest points any spread reaching it spends.
 */
function bruteForce(weights: Weights, options: readonly Ability[]): { value: number; spent: number } {
  const placements: Partial<AbilityScores>[] = []
  for (const a of [0, 1, 2]) for (const b of [0, 1, 2]) for (const c of [0, 1, 2]) {
    const bonuses = { [options[0]]: a, [options[1]]: b, [options[2]]: c }
    if (originSpreadValid(bonuses)) placements.push(bonuses)
  }

  let best = { value: -Infinity, spent: Infinity }
  for (const bonuses of placements) {
    const visit = (i: number, spent: number, value: number) => {
      if (spent > POINT_BUY_BUDGET) return
      if (i === ABILITIES.length) {
        if (value > best.value || (value === best.value && spent < best.spent)) best = { value, spent }
        return
      }
      const ability = ABILITIES[i]
      for (let score = 8; score <= 15; score++) {
        const bonus = bonuses[ability] ?? 0
        visit(i + 1, spent + POINT_BUY_COST[score], value + weights[ability] * abilityModifier(score + bonus))
      }
    }
    visit(0, 0, 0)
  }
  return best
}

/** The weighted total a spread actually earns, worked out from the spread itself. */
const valueOf = (weights: Weights, base: AbilityScores, bonuses: Partial<AbilityScores>) =>
  ABILITIES.reduce((sum, ability) => sum + weights[ability] * abilityModifier(base[ability] + (bonuses[ability] ?? 0)), 0)

describe('class weights', () => {
  it('counts primary abilities 3, saving throws and Constitution 2, and the rest 1', () => {
    expect(classWeights(CLASSES.Wizard)).toEqual({ STR: 1, DEX: 1, CON: 2, INT: 3, WIS: 2, CHA: 1 })
    expect(classWeights(CLASSES.Fighter)).toEqual({ STR: 3, DEX: 3, CON: 2, INT: 1, WIS: 1, CHA: 1 })
  })
})

describe('bonus placements', () => {
  it('offers the seven legal placements, all on the background abilities', () => {
    const placements = bonusPlacements(BACKGROUNDS.Sage)

    expect(placements).toHaveLength(7)
    expect(new Set(placements.map((p) => JSON.stringify(p))).size).toBe(7)
    for (const placement of placements) {
      expect(originSpreadValid(placement)).toBe(true)
      expect(Object.keys(placement).every((a) => BACKGROUNDS.Sage.includes(a as Ability))).toBe(true)
    }
  })
})

describe('wasted points (UT-86)', () => {
  it('names the cheaper score that reaches the same modifier', () => {
    expect(cheaperScore(13)).toBe(12)
    expect(cheaperScore(15)).toBe(14)
    expect(cheaperScore(15, 2)).toBe(14)
    expect(cheaperScore(14, 1)).toBe(13)
    expect(cheaperScore(10, 1)).toBe(9)
  })

  it('lets an odd score stand when a +1 bonus lifts it to the next modifier', () => {
    expect(cheaperScore(13, 1)).toBeNull()
    expect(cheaperScore(15, 1)).toBeNull()
    expect(cheaperScore(14)).toBeNull()
    expect(cheaperScore(8)).toBeNull()
  })

  it('keeps only the scores worth buying for each bonus', () => {
    expect(worthBuying(0)).toEqual([8, 10, 12, 14])
    expect(worthBuying(2)).toEqual([8, 10, 12, 14])
    expect(worthBuying(1)).toEqual([8, 9, 11, 13, 15])
  })
})

describe('the recommended spread (UT-87)', () => {
  const cases = Object.entries(CLASSES).flatMap(([cls, traits]) =>
    Object.entries(BACKGROUNDS).map(([bg, options]) => ({ cls, bg, weights: classWeights(traits), options })),
  )

  it.each(cases)('matches the true optimum, at its lowest cost, for a $cls with the $bg background', ({ weights, options }) => {
    const rec = recommend(weights, options)!

    expect({ value: rec.value, spent: rec.spent }).toEqual(bruteForce(weights, options))
    expect(valueOf(weights, rec.base, rec.bonuses)).toBe(rec.value)
    expect(pointBuySpent(rec.base)).toBe(rec.spent)
    expect(rec.spent).toBeLessThanOrEqual(POINT_BUY_BUDGET)
    expect(originSpreadValid(rec.bonuses)).toBe(true)
  })

  it('agrees with the totals in the algorithm specification', () => {
    const value = (cls: string, bg: string) => recommend(classWeights(CLASSES[cls]), BACKGROUNDS[bg])?.value

    expect(value('Wizard', 'Sage')).toBe(18)
    expect(value('Wizard', 'Soldier')).toBe(16)
    expect(value('Fighter', 'Soldier')).toBe(21)
    expect(value('Fighter', 'Acolyte')).toBe(17)
    expect(value('Monk', 'Sage')).toBe(21)
    expect(value('Paladin', 'Acolyte')).toBe(21)
  })

  it('settles ties the same way every time: the cheaper spread, then the earlier placement', () => {
    expect(recommend(classWeights(CLASSES.Wizard), BACKGROUNDS.Sage)).toEqual({
      base: { STR: 12, DEX: 8, CON: 14, INT: 15, WIS: 14, CHA: 8 },
      bonuses: { CON: 2, INT: 1 },
      spent: 27,
      value: 18,
    })
    expect(recommend(classWeights(CLASSES.Wizard), BACKGROUNDS.Soldier)?.spent).toBe(26)
  })

  it('recommends nothing when the background offers no abilities', () => {
    expect(recommend(classWeights(CLASSES.Wizard), [])).toBeNull()
  })
})

/** The SRD 2024 classes with no Spellcasting feature at level 1. */
const NON_CASTERS = new Set(['Barbarian', 'Fighter', 'Monk', 'Rogue'])

describe('character-type presets (US-42)', () => {
  it('offers Caster only to a class that casts at level 1', () => {
    expect(presetOptions({ casterType: 'NONE' })).toEqual(['Tank', 'Striker', 'Skill-Focused'])
    expect(presetOptions({ casterType: 'FULL' })).toEqual(['Tank', 'Striker', 'Caster', 'Skill-Focused'])
    expect(presetOptions({ casterType: 'HALF' })).toContain('Caster')
    expect(presetOptions({ casterType: 'PACT' })).toContain('Caster')
    expect(presetOptions(undefined)).toEqual([])
  })

  it('weighs the abilities by the deep dive table, lifting a primary ability only where the preset says to', () => {
    // Tank and Skill-Focused name every ability they care about; the class's primary ability gets nothing extra.
    expect(presetWeight(CLASSES.Wizard, 'Tank')).toEqual({ STR: 3, DEX: 2, CON: 3, INT: 1, WIS: 1, CHA: 1 })
    expect(presetWeight(CLASSES.Wizard, 'Skill-Focused')).toEqual({ STR: 1, DEX: 3, CON: 1, INT: 2, WIS: 2, CHA: 2 })
    // Striker and Caster put the primary ability at 3, and a listed 2 never pulls it down.
    expect(presetWeight(CLASSES.Wizard, 'Striker')).toEqual({ STR: 1, DEX: 2, CON: 2, INT: 3, WIS: 1, CHA: 1 })
    expect(presetWeight(CLASSES.Fighter, 'Striker')).toEqual({ STR: 3, DEX: 3, CON: 2, INT: 1, WIS: 1, CHA: 1 })
    expect(presetWeight(CLASSES.Cleric, 'Caster')).toEqual({ STR: 1, DEX: 1, CON: 2, INT: 1, WIS: 3, CHA: 1 })
    expect(presetWeight(CLASSES.Bard, 'Caster')).toEqual({ STR: 1, DEX: 1, CON: 2, INT: 1, WIS: 2, CHA: 3 })
  })

  it('falls back to the class weights when no preset is chosen', () => {
    for (const traits of Object.values(CLASSES)) expect(adviceWeights(traits, null)).toEqual(classWeights(traits))
    expect(adviceWeights(CLASSES.Wizard, 'Tank')).toEqual(presetWeight(CLASSES.Wizard, 'Tank'))
  })

  /**
   * Every preset a class can pick, on every background, each distinct weighting once: Tank and Skill-Focused
   * weigh all classes alike (4 + 4), Striker has 8 distinct weightings and Caster 5, one of them, the Ranger's,
   * the same as its Striker (32 + 16). That's 56 of the 176.
   */
  const cases = Object.entries(CLASSES)
    .flatMap(([cls, traits]) =>
      presetOptions({ casterType: NON_CASTERS.has(cls) ? 'NONE' : 'FULL' }).flatMap((preset) =>
        Object.entries(BACKGROUNDS).map(([bg, options]) => ({ cls, preset, bg, weights: presetWeight(traits, preset), options })),
      ),
    )
    .filter((c, i, all) => all.findIndex((d) => JSON.stringify([d.weights, d.options]) === JSON.stringify([c.weights, c.options])) === i)

  it('covers every distinct weighting', () => {
    expect(cases).toHaveLength(56)
  })

  it.each(cases)('matches the true optimum for the $preset preset on a $cls with the $bg background', ({ weights, options }) => {
    const rec = recommend(weights, options)!

    expect({ value: rec.value, spent: rec.spent }).toEqual(bruteForce(weights, options))
    expect(valueOf(weights, rec.base, rec.bonuses)).toBe(rec.value)
    expect(pointBuySpent(rec.base)).toBe(rec.spent)
    expect(originSpreadValid(rec.bonuses)).toBe(true)
  })
})
