import { describe, expect, it } from "vitest";
import { skillIdsFromNames } from "../data/skills";
import { toSkill } from "../data/normalize";
import type { RawSkill } from "../data/normalize";
import type { Envelope } from "../lib/api";
import { TEST_SKILLS } from "./fixtures";

const record = (key: string, name: string, ability: string): Envelope<RawSkill> => ({
  type: 'skill', key, name, document: 'core', data: { ability },
})

describe('toSkill', () => {
  it('reads the three-letter ability code the service sends', () => {
    expect(toSkill(record('stealth', 'Stealth', 'dex'))).toEqual({
      id: 'stealth', name: 'Stealth', ability: 'DEX',
    })
  })

  it('refuses a skill whose ability it cannot read', () => {
    expect(() => toSkill(record('vibes', 'Vibes', 'luck'))).toThrow(/unknown ability/)
  })
})

describe('skillIdsFromNames', () => {
  it('maps a comma list to ids', () => {
    expect(skillIdsFromNames('Insight, Religion', TEST_SKILLS)).toEqual(['insight', 'religion'])
  })

  it('ignores case and surrounding space', () => {
    expect(skillIdsFromNames('  sleight of hand  ,STEALTH', TEST_SKILLS))
      .toEqual(['sleight-of-hand', 'stealth'])
  })

  it('drops a name it does not know', () => {
    expect(skillIdsFromNames('Insight, Basket Weaving', TEST_SKILLS)).toEqual(['insight'])
  })

  it('returns nothing for an empty string', () => {
    expect(skillIdsFromNames('', TEST_SKILLS)).toEqual([])
  })
})