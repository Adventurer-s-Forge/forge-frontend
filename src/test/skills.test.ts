import { describe, expect, it } from "vitest";
import { SKILLS, skillIdsFromNames } from "../data/skills";

describe('skills', () => { 
  it('holds the eighteen SRD skills with unique ids', () => {
    expect(SKILLS).toHaveLength(18)
    expect(new Set(SKILLS.map((skill) => skill.id)).size).toBe(18)
  })

  it('maps a comma-separated list of names onto ids', () => {
    expect(skillIdsFromNames('Insight, Religion')).toEqual(['insight', 'religion'])
  })

  it('tolerate spacing and case', () => {
    expect(skillIdsFromNames('  sleight of hand ,STEALTH')).toEqual(['sleight-of-hand', 'stealth'])
  })

  it('drops unrecognized names rather than emitting undefined', () => {
    expect(skillIdsFromNames('Insight, Basket Weaving')).toEqual(['insight'])
  })

  it('returns nothing for an empty string', () => {
    expect(skillIdsFromNames('')).toEqual([])
  })
})