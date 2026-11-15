import { describe, expect, it } from 'vitest'
import { firstName } from '../components/character/sheets'

describe('firstName', () => {
  it.each([
    ['Paul De Silos', 'Paul'],
    ['  Paul   De Silos ', 'Paul'],
    ['Cher', 'Cher'],
    ['Mary-Jane Watson', 'Mary-Jane'],
    ['', ''],
    ['   ', ''],
    [null, ''],
    [undefined, ''],
  ])('%j -> %j', (input, expected) => {
    expect(firstName(input)).toBe(expected)
  })
})
