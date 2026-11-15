import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { STEPS, createDraft, type Character } from "../characters/character";
import { completeStep, setClass, setEquipmentChoice, setRace } from "../characters/progress";
import { CharacterSheet } from "../components/character/CharacterSheet";
import { catalog, seedCatalog, type Equipment, type Spell } from "../data/catalog";
import { seedTestCatalog } from "./fixtures";

/** The shared fixtures carry no attack data, so the weapons and cantrips the attack table reads are added here. */
const LONGSWORD: Equipment['weapon'] = { damage: '1d8', damageType: 'slashing', martial: true, properties: ['Sap', 'Versatile'] }

const WEAPONS: Equipment[] = [
  { id: 'srd-2024_dagger', name: 'Dagger', category: 'weapon', desc: '', costCp: 200,
    weapon: { damage: '1d4', damageType: 'piercing', martial: false, properties: ['Finesse', 'Light', 'Thrown'] } },
  { id: 'srd-2024_longbow', name: 'Longbow', category: 'weapon', desc: '', costCp: 5000,
    weapon: { damage: '1d8', damageType: 'piercing', martial: true, properties: ['Ammunition', 'Heavy', 'Two-Handed'] } },
]

const ACID_SPLASH: Spell = {
  id: 'srd-2024_acid-splash', name: 'Acid Splash', level: 0, school: 'Evocation', classIds: ['srd-2024_wizard'],
  desc: '', concentration: false, ritual: false, castingTime: '', range: '', duration: '',
  attack: { save: 'DEX', damage: '1d6', damageType: 'acid' },
}

beforeAll(() => {
  seedTestCatalog()
  seedCatalog({
    ...catalog,
    equipment: [
      ...catalog.equipment.map((item) => (item.id === 'srd-2024_longsword' ? { ...item, weapon: LONGSWORD } : item)),
      ...WEAPONS,
    ],
    spells: [
      ...catalog.spells.map((spell) =>
        spell.id === 'srd-2024_fire-bolt' ? { ...spell, attack: { save: null, damage: '1d10', damageType: 'fire' } } : spell,
      ),
      ACID_SPLASH,
    ],
  })
})

/** A finished Human Fighter with Archery. The Soldier's +2/+1 make STR 17 and CON 14, so +3 and +2,
 * and DEX stays 14 for +2. The class kit grants Chain mail and a Longsword; two Daggers and a Longbow were bought. */
function fighter(overrides: Partial<Character> = {}): Character {
  let c: Character = {
    ...createDraft(),
    name: 'Brannoc',
    backgroundId: 'srd-2024_soldier',
    toolChoiceId: 'srd-2024_gaming-set-dice',
  }
  c = setRace(c, 'srd-2024_human')
  c = setClass(c, 'srd-2024_fighter')
  c = setEquipmentChoice(c, 'class', 'A')
  c = {
    ...c,
    fightingStyleId: 'archery',
    abilities: {
      method: 'standard',
      base: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 },
      rolled: [],
      originBonuses: { STR: 2, CON: 1 },
    },
    proficientSkillIds: ['perception', 'survival'],
    purchasedItemIds: ['srd-2024_dagger', 'srd-2024_dagger', 'srd-2024_longbow'],
    walletCp: 1234,
    ...overrides,
  }
  for (const { id } of STEPS) c = completeStep(c, id)
  return c
}

/** An unfinished Human Wizard. The Acolyte's +2 makes INT 17, so +3: save DC 13 and spell attack +5. */
function wizard(overrides: Partial<Character> = {}): Character {
  return {
    ...createDraft(),
    name: 'Ilse',
    raceId: 'srd-2024_human',
    classId: 'srd-2024_wizard',
    backgroundId: 'srd-2024_acolyte',
    abilities: {
      method: 'standard',
      base: { STR: 10, DEX: 14, CON: 13, INT: 15, WIS: 12, CHA: 8 },
      rolled: [],
      originBonuses: { INT: 2, WIS: 1 },
    },
    spellIds: ['srd-2024_fire-bolt', 'srd-2024_acid-splash', 'srd-2024_shield'],
    ...overrides,
  }
}

function sheet(character: Character, playerName: string | null = 'Paul De Silos') {
  const onClose = vi.fn()
  const onEdit = vi.fn()
  render(<CharacterSheet character={character} playerName={playerName} onClose={onClose} onEdit={onEdit} />)
  return { onClose, onEdit }
}

const page = (name: 'Character' | 'Appearance and backstory' | 'Spellcasting') =>
  within(screen.getByRole('article', { name }))

/** A paper-sheet field prints its value above its label. */
const field = (label: string, on = page('Character')) => on.getByText(label).previousSibling?.textContent

/** A framed box, found by the caption printed under it. */
const box = (caption: string) => screen.getByRole('heading', { name: caption }).parentElement!

const texts = (elements: Element[]) => elements.map((element) => element.textContent)

const attackRows = () =>
  within(box('Attacks & spellcasting'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => texts(within(row).getAllByRole('cell')))

describe('the sheet laid out like the paper one (US-33, FR-13)', () => {
  it('runs over three pages: the character, the person, and their spells', () => {
    sheet(fighter())

    expect(screen.getAllByRole('article').map((article) => article.getAttribute('aria-label'))).toEqual([
      'Character',
      'Appearance and backstory',
      'Spellcasting',
    ])
  })

  it('fills the header from the character, and Player name from the account', () => {
    sheet(fighter())

    expect(field('Class & level')).toBe('Fighter 1')
    expect(field('Background')).toBe('Soldier')
    expect(field('Race')).toBe('Human')
    expect(field('Player name')).toBe('Paul')
  })

  it('leaves Player name blank to write in when the account has no name', () => {
    sheet(fighter(), null)

    expect(field('Player name')).toBe('')
  })

  it('prints each ability with its modifier and final score', () => {
    sheet(fighter())

    expect(texts(within(screen.getByRole('list', { name: 'Ability scores' })).getAllByRole('listitem'))).toEqual([
      'Strength+317',
      'Dexterity+214',
      'Constitution+214',
      'Intelligence+112',
      'Wisdom+010',
      'Charisma−18',
    ])
  })

  it('marks the two saves the class grants and adds the proficiency bonus to them alone', () => {
    sheet(fighter())
    const saves = within(box('Saving throws')).getAllByRole('listitem')
    const marked = saves.filter((save) => within(save).queryByRole('img', { name: 'Proficient' }))

    expect(texts(saves)).toEqual(['+5Strength', '+2Dexterity', '+4Constitution', '+1Intelligence', '+0Wisdom', '−1Charisma'])
    expect(marked.map((save) => save.lastChild?.textContent)).toEqual(['Strength', 'Constitution'])
  })

  it('tells expertise from proficiency on the skill markers', () => {
    sheet({
      ...createDraft(),
      name: 'Vex',
      classId: 'srd-2024_rogue',
      proficientSkillIds: ['acrobatics', 'stealth'],
      expertiseIds: ['stealth'],
      abilities: { method: 'standard', base: { DEX: 16 }, rolled: [], originBonuses: {} },
    })
    const skill = (name: string) => within(within(box('Skills')).getByText(name).closest('li')!)

    expect(skill('Stealth').getByRole('img', { name: 'Expertise' })).toBeInTheDocument()
    expect(skill('Stealth').getByText('+7')).toBeInTheDocument()
    expect(skill('Acrobatics').getByRole('img', { name: 'Proficient' })).toBeInTheDocument()
    expect(skill('Acrobatics').getByText('+5')).toBeInTheDocument()
    expect(skill('Sleight of Hand').queryByRole('img')).not.toBeInTheDocument()
  })

  it('keys the two markers under the skills, hidden from screen readers since each marker names itself', () => {
    sheet(fighter())

    const key = within(box('Skills')).getByText('Expertise')
    expect(key.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('fills the combat block from the derived values', () => {
    sheet(fighter())

    expect(field('Armor class')).toBe('16')
    expect(field('Initiative')).toBe('+2')
    expect(field('Speed')).toBe('30')
    expect(field('Passive Wisdom (Perception)')).toBe('12')
    expect(screen.getByText(/Hit Point Maximum/)).toHaveTextContent('Hit Point Maximum 12')
    expect(screen.getByText(/^Total/)).toHaveTextContent('Total 1d10')
  })
})

describe('attacks and spellcasting (US-8, FR-7)', () => {
  it('adds proficiency for a weapon the class is trained in, on the ability its properties call for', () => {
    sheet(fighter())

    // Longsword on STR; Dagger is finesse and STR is the better; Longbow fires ammunition, so DEX plus Archery.
    // The two Daggers bought share one row.
    expect(attackRows()).toEqual([
      ['Longsword', '+5', '1d8+3 slashing'],
      ['Dagger', '+5', '1d4+3 piercing'],
      ['Longbow', '+6', '1d8+2 piercing'],
    ])
  })

  it('lets a finesse weapon use Dexterity when it is the better score', () => {
    sheet(
      fighter({
        abilities: {
          method: 'standard',
          base: { STR: 10, DEX: 15, CON: 13, INT: 12, WIS: 14, CHA: 8 },
          rolled: [],
          originBonuses: { DEX: 2, CON: 1 },
        },
      }),
    )

    expect(attackRows()[0]).toEqual(['Longsword', '+2', '1d8 slashing'])
    expect(attackRows()[1]).toEqual(['Dagger', '+5', '1d4+3 piercing'])
  })

  it('gives Archery only to a weapon that fires ammunition', () => {
    sheet(fighter({ fightingStyleId: 'defense' }))

    expect(attackRows()[2]).toEqual(['Longbow', '+4', '1d8+2 piercing'])
  })

  it('leaves the proficiency bonus off a weapon the class is not trained in', () => {
    sheet(wizard({ spellIds: [], purchasedItemIds: ['srd-2024_longsword'] }))

    expect(attackRows()[0]).toEqual(['Longsword', '+0', '1d8 slashing'])
  })

  it('lists each damaging cantrip with its attack bonus or save DC, and no levelled spells', () => {
    sheet(wizard())

    expect(attackRows()).toEqual([
      ['Fire Bolt', '+5', '1d10 fire'],
      ['Acid Splash', 'DC 13 Dex', '1d6 acid'],
      ['', '', ''],
    ])
  })

  it('keeps three blank lines to write in when there is nothing to list', () => {
    sheet(wizard({ spellIds: [] }))

    expect(attackRows()).toEqual([['', '', ''], ['', '', ''], ['', '', '']])
  })
})

describe('equipment, features and proficiencies (US-33, FR-13)', () => {
  it('merges the class kit and the shop into one list, counting repeats', () => {
    sheet(fighter())
    const items = within(box('Equipment')).getAllByRole('list')[1]

    expect(texts(within(items).getAllByRole('listitem'))).toEqual(['Chain mail', 'Longsword', 'Dagger ×2', 'Longbow'])
  })

  it('splits the purse into gold, silver and copper, leaving EP and PP blank', () => {
    sheet(fighter())

    expect(texts(within(screen.getByRole('list', { name: 'Coins' })).getAllByRole('listitem'))).toEqual([
      'CP4',
      'SP3',
      'EP',
      'GP12',
      'PP',
    ])
  })

  it('lists race traits, class features, the fighting style and the background feat, each with its source', () => {
    sheet(fighter())

    expect(texts(within(box('Features & traits')).getAllByRole('listitem'))).toEqual([
      'Skillful Human',
      'Second Wind Fighter',
      'Fighting Style: Archery Fighter',
      'Savage Attacker Soldier',
    ])
  })

  it('names the tool the player picked', () => {
    sheet(fighter())

    expect(texts([...box('Other proficiencies & languages').querySelectorAll('p')])).toEqual([
      'Armor. Light, Medium, and Heavy armor and Shields',
      'Weapons. Simple and Martial weapons',
      'Tools. Gaming Set, Dice',
    ])
  })

  it('falls back to the background tool, and skips a proficiency the class does not have', () => {
    sheet(wizard())

    expect(texts([...box('Other proficiencies & languages').querySelectorAll('p')])).toEqual([
      "Tools. Calligrapher's Supplies",
    ])
  })
})

describe('the spell page (US-33, FR-13)', () => {
  it('heads the page with the casting class, its ability, save DC and attack bonus', () => {
    sheet(wizard())
    const spells = page('Spellcasting')

    expect(field('Spellcasting class', spells)).toBe('Wizard')
    expect(field('Spellcasting ability', spells)).toBe('Intelligence')
    expect(field('Spell save DC', spells)).toBe('13')
    expect(field('Spell attack bonus', spells)).toBe('+5')
  })

  it('files each spell under its level, with the slot count beside level 1', () => {
    sheet(wizard())
    const level = (name: string) => within(screen.getByRole('region', { name }))
    const named = (name: string) => texts(level(name).getAllByRole('listitem')).filter(Boolean)

    expect(named('Cantrips')).toEqual(['Fire Bolt', 'Acid Splash'])
    expect(named('Level 1 spells')).toEqual(['Shield'])
    expect(level('Level 1 spells').getByText('2')).toBeInTheDocument()
  })

  it('leaves the spell page blank for a class that casts nothing', () => {
    sheet(fighter())
    const spells = page('Spellcasting')

    expect(field('Spellcasting class', spells)).toBe('')
    expect(field('Spell save DC', spells)).toBe('')
    expect(field('Spell attack bonus', spells)).toBe('')
  })
})

describe('exporting the sheet (US-32, FR-13)', () => {
  it('holds the export back until the character is finished', () => {
    sheet(wizard())

    const print = screen.getByRole('button', { name: 'Print or save as PDF' })
    expect(print).toBeDisabled()
    expect(print).toHaveAttribute('title', 'Finish the character to export its sheet')
  })

  it("opens the browser's print dialog for a finished character", async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    sheet(fighter())

    await userEvent.click(screen.getByRole('button', { name: 'Print or save as PDF' }))

    expect(print).toHaveBeenCalledTimes(1)
    print.mockRestore()
  })

  it('hands Edit and Close back to the dashboard', async () => {
    const { onClose, onEdit } = sheet(fighter())

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape and on a click outside the sheet, but not on a click inside it', () => {
    const { onClose } = sheet(fighter())
    const dialog = screen.getByRole('dialog', { name: 'Brannoc' })

    // fireEvent returns false when the handler prevents the default -- the dialog leaves closing to the dashboard.
    expect(fireEvent(dialog, new Event('cancel', { cancelable: true }))).toBe(false)
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(dialog)
    expect(onClose).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('article', { name: 'Character' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
