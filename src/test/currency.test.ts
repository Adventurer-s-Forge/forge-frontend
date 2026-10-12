import { describe, expect, it } from "vitest";
import { CP_PER, formatCoins, gpToCp, parseCostCp } from "../characters/currency";

describe('coin values', () => {
  it('values each coin against the gold piece', () => {
    expect(CP_PER.CP).toBe(1)
    expect(CP_PER.SP).toBe(10)
    expect(CP_PER.EP).toBe(50)
    expect(CP_PER.GP).toBe(100)
    expect(CP_PER.PP).toBe(1000)
  })
})

describe('parsing costs', () => {
  it('converts a gold string to integer copper', () => {
    expect(parseCostCp('25.00')).toBe(2500)
    expect(parseCostCp('1.00')).toBe(100)
    expect(parseCostCp('0.10')).toBe(10)
    expect(parseCostCp('0.01')).toBe(1)
  })

  it('survives the two decimals that would drift as floats', () => {
    // 0.07 * 100 is 7.000000000000001 in binary floating point.
    expect(parseCostCp('0.07')).toBe(7)
    expect(parseCostCp('0.29')).toBe(29)
    expect(parseCostCp('1.15')).toBe(115)
    expect(Number.isInteger(parseCostCp('0.07'))).toBe(true)
  })

  it('handles the extremes present in the catalog', () => {
    expect(parseCostCp('40000.00')).toBe(4000000)
    expect(parseCostCp('0.00')).toBe(0)
  })

  it('treats an absent or unparseable cost as free rather than NaN', () => {
    expect(parseCostCp(null)).toBe(0)
    expect(parseCostCp(undefined)).toBe(0)
    expect(parseCostCp('')).toBe(0)
    expect(parseCostCp('priceless')).toBe(0)
  })

  it('agrees with gpToCp', () => {
    expect(gpToCp(75)).toBe(parseCostCp('75.00'))
    expect(gpToCp(0.5)).toBe(50)
  })
})

describe('formatting coins', () => {
  it('names the largest coins first and drops empty ones', () => {
    expect(formatCoins(7500)).toBe('75 GP')
    expect(formatCoins(1234)).toBe('12 GP 3 SP 4 CP')
    expect(formatCoins(1204)).toBe('12 GP 4 CP')
    expect(formatCoins(40)).toBe('4 SP')
    expect(formatCoins(7)).toBe('7 CP')
  })

  it('reads an empty purse in gold rather than as nothing', () => {
    expect(formatCoins(0)).toBe('0 GP')
  })

  it('marks an overdrawn purse with a real minus sign', () => {
    expect(formatCoins(-100)).toBe('\u22121 GP')
    expect(formatCoins(-1234)).toBe('\u221212 GP 3 SP 4 CP')
  })

  it('leaves electrum and platinum out of its output', () => {
    // Both are in CP_PER for coins a player is handed, but nothing at
    // level 1 is priced in them, so a purse never quotes them.
    expect(formatCoins(CP_PER.EP)).toBe('5 SP')
    expect(formatCoins(CP_PER.PP)).toBe('10 GP')
  })
})
