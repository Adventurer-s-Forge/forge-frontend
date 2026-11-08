import { describe, expect, it } from "vitest";
import {
  fullHp,
  heal,
  record,
  rollDie,
  setTemp,
  spendHitdie,
  startSession,
  takeDmg,
  undo,
  type HpState,
} from "../characters/hitPoints";

/** A level 1 Fighter with CON 14: d10 + 2, so 12 hit points and one hit die. */
const FULL = fullHp(12, 1)

const at = (over: Partial<HpState>): HpState => ({ ...FULL, ...over })

describe('a fresh session (FR-8)', () => {
  it('starts at full, with no temporary hit points and every hit die', () => {
    expect(startSession(12, 1)).toEqual({
      state: { max: 12, current: 12, temp: 0, hitDiceLeft: 1 },
      log: [],
    })
  })
})

describe('taking damage (FR-8)', () => {
  it('takes the damage off the current hit points', () => {
    expect(takeDmg(FULL, 5).current).toBe(7)
  })

  it('stops at 0 rather than going negative', () => {
    expect(takeDmg(at({ current: 3 }), 40).current).toBe(0)
  })

  it('spends the temporary hit points first and carries the rest over', () => {
    expect(takeDmg(at({ temp: 3 }), 5)).toMatchObject({ temp: 0, current: 10 })
  })

  it('leaves the real hit points alone when the temporary ones soak it all', () => {
    expect(takeDmg(at({ temp: 5 }), 3)).toMatchObject({ temp: 2, current: 12 })
  })

  it('rounds a fraction down and ignores a negative or a non-number', () => {
    expect(takeDmg(FULL, 2.7).current).toBe(10)
    expect(takeDmg(FULL, -4)).toEqual(FULL)
    expect(takeDmg(FULL, Number.NaN)).toEqual(FULL)
  })

  it('does not change the state it was given', () => {
    const before = at({ temp: 2 })
    takeDmg(before, 6)

    expect(before).toEqual(at({ temp: 2 }))
  })
})

describe('healing (FR-8)', () => {
  it('adds the healing to the current hit points', () => {
    expect(heal(at({ current: 4 }), 5).current).toBe(9)
  })

  it('never heals past the maximum', () => {
    expect(heal(at({ current: 10 }), 50).current).toBe(12)
  })

  it('brings a character back up from 0', () => {
    expect(heal(at({ current: 0 }), 3).current).toBe(3)
  })

  it('never touches the temporary hit points', () => {
    expect(heal(at({ current: 4, temp: 2 }), 5).temp).toBe(2)
  })

  it('cannot be turned into damage with a negative amount', () => {
    expect(heal(at({ current: 4 }), -3).current).toBe(4)
  })
})

describe('temporary hit points (FR-8)', () => {
  it('replaces the pool rather than stacking on it', () => {
    expect(setTemp(at({ temp: 5 }), 3).temp).toBe(3)
  })

  it('never goes below 0', () => {
    expect(setTemp(FULL, -1).temp).toBe(0)
  })
})

describe('spending a hit die on a short rest (FR-8)', () => {
  it('heals the roll plus the Constitution modifier and uses up the die', () => {
    expect(spendHitdie(at({ current: 2 }), 6, 2)).toMatchObject({ current: 10, hitDiceLeft: 0 })
  })

  it('heals at least 1 even when Constitution takes the roll below it', () => {
    expect(spendHitdie(at({ current: 2 }), 1, -2).current).toBe(3)
  })

  it('still stops at the maximum', () => {
    expect(spendHitdie(at({ current: 11 }), 10, 2).current).toBe(12)
  })

  it('does nothing once the hit dice are gone', () => {
    const spent = at({ current: 2, hitDiceLeft: 0 })

    expect(spendHitdie(spent, 6, 2)).toBe(spent)
  })
})

describe('rolling a die', () => {
  it('rolls 1 at the bottom of the range and the number of sides at the top', () => {
    expect(rollDie(10, () => 0)).toBe(1)
    expect(rollDie(10, () => 0.9999)).toBe(10)
    expect(rollDie(6, () => 0.5)).toBe(4)
  })

  it('stays between 1 and the number of sides with the real random source', () => {
    const rolls = Array.from({ length: 200 }, () => rollDie(4))

    expect(rolls.every((n) => Number.isInteger(n) && n >= 1 && n <= 4)).toBe(true)
  })
})

describe('the session log and undo (FR-8)', () => {
  it('logs a step newest first, with the state before and after it', () => {
    let session = startSession(12, 1)
    session = record(session, 'Took 5', takeDmg(session.state, 5))
    session = record(session, 'Healed 2', heal(session.state, 2))

    expect(session.state.current).toBe(9)
    expect(session.log.map((entry) => entry.label)).toEqual(['Healed 2', 'Took 5'])
    expect(session.log[1].before.current).toBe(12)
    expect(session.log[1].after.current).toBe(7)
  })

  it('does not log a step that changed nothing, so undo never undoes a no-op', () => {
    const session = startSession(12, 1)

    expect(record(session, 'Healed 5', heal(session.state, 5))).toBe(session)
  })

  it('logs a step that only changed the temporary hit points', () => {
    const session = startSession(12, 1)

    expect(record(session, 'Temp HP +1', setTemp(session.state, 1)).log).toHaveLength(1)
  })

  it('walks back one step at a time, newest first', () => {
    let session = startSession(12, 1)
    session = record(session, 'Took 3', takeDmg(session.state, 3))
    session = record(session, 'Took 4', takeDmg(session.state, 4))

    session = undo(session)
    expect(session.state.current).toBe(9)
    expect(session.log).toHaveLength(1)

    session = undo(session)
    expect(session).toEqual(startSession(12, 1))
  })

  it('leaves an empty session as it is', () => {
    const session = startSession(12, 1)

    expect(undo(session)).toBe(session)
  })
})
