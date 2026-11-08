import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createDraft, type Character } from "../characters/character";
import { HpSimulator } from "../components/character/HpSimulator";
import { seedTestCatalog } from "./fixtures";

beforeAll(seedTestCatalog)

afterEach(() => {
  vi.restoreAllMocks()
})

/** A Dwarf Fighter with CON 14: d10 + 2, so 12 hit points and one hit die at level 1. */
const VEX: Character = {
  ...createDraft(),
  name: 'Vex',
  raceId: 'srd-2024_dwarf',
  classId: 'srd-2024_fighter',
  backgroundId: 'srd-2024_acolyte',
  abilities: {
    method: 'standard',
    base: { STR: 15, DEX: 13, CON: 14, INT: 12, WIS: 10, CHA: 8 },
    rolled: [],
    originBonuses: {},
  },
}

function show() {
  const onClose = vi.fn()
  render(<HpSimulator character={VEX} onClose={onClose} />)
  return onClose
}

const meter = () => screen.getByRole('region', { name: 'Hit points' })
const current = () => meter().querySelector('.hp-current')?.textContent
const temp = () => meter().querySelector('.stepper span')?.textContent
const log = () => within(screen.getByRole('complementary', { name: 'This session' }))
const amount = () => screen.getByRole<HTMLInputElement>('spinbutton')
/** The preview line, e.g. "HP 12 → 7" -- it renders a blank space while there is nothing to preview. */
const preview = () => screen.queryByText(/^HP \d/)
/** With no amount entered, the mode chip and the submit button share a name ("Take damage", "Heal"),
 * so the chips are found in their group and the submit button through the form. */
const modes = () => within(screen.getByRole('group', { name: 'Action' }))
const submit = () => amount().form!.querySelector<HTMLButtonElement>('button[type="submit"]')!
const chooseHeal = () => userEvent.click(modes().getByRole('button', { name: 'Heal' }))

/** Rolls come from Math.random, and 0.5 lands a d6 on 4 and a d10 on 6. */
const fixRolls = () => vi.spyOn(Math, 'random').mockReturnValue(0.5)

async function enter(points: number) {
  await userEvent.clear(amount())
  await userEvent.type(amount(), String(points))
}

async function take(points: number) {
  await enter(points)
  await userEvent.click(screen.getByRole('button', { name: `Take ${points} damage` }))
}

describe('opening the simulator (FR-8, US-11)', () => {
  it('opens at full, with the maximum the sheet derives and every hit die', () => {
    show()

    expect(screen.getByRole('dialog', { name: 'Vex' })).toBeInTheDocument()
    expect(current()).toBe('12')
    expect(within(meter()).getByText('Hit dice 1 / 1 · d10')).toBeInTheDocument()
    expect(screen.getByText(/at full/)).toHaveTextContent('12 / 12')
  })

  it('names the build and says that nothing is kept', () => {
    show()

    expect(screen.getByRole('dialog')).toHaveTextContent(/HP simulator · Dwarf · Fighter · Acolyte/i)
    expect(screen.getByText('practice only, nothing is saved')).toBeInTheDocument()
    expect(log().getByText(/Nothing here is saved/)).toBeInTheDocument()
  })

  it('starts with nothing to undo and nothing to reset', () => {
    show()

    expect(log().getByText('Nothing yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo last' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reset to full' })).toBeDisabled()
  })
})

describe('taking damage (FR-8)', () => {
  it('previews the result before anything is applied', async () => {
    show()

    await enter(5)

    expect(preview()).toHaveTextContent('HP 12 → 7')
    expect(current()).toBe('12')
    expect(screen.getByRole('button', { name: 'Take 5 damage' })).toBeEnabled()
  })

  it('applies the damage, logs it and clears the amount', async () => {
    show()

    await take(5)

    expect(current()).toBe('7')
    expect(amount()).toHaveValue(null)
    const [entry] = log().getAllByRole('listitem')
    expect(within(entry).getByText('−5')).toBeInTheDocument()
    expect(within(entry).getByText('Took 5')).toBeInTheDocument()
    expect(within(entry).getByText('12 → 7')).toBeInTheDocument()
  })

  it('will not apply an amount that is not a whole number above 0', async () => {
    show()
    expect(submit()).toBeDisabled()
    expect(submit()).toHaveTextContent('Take damage')

    await enter(0)
    expect(submit()).toBeDisabled()

    fireEvent.change(amount(), { target: { value: '2.5' } })
    expect(submit()).toBeDisabled()
    expect(preview()).not.toBeInTheDocument()
  })

  it('lets temporary hit points soak the damage first', async () => {
    show()
    const add = screen.getByRole('button', { name: /^Add a temp/ })
    await userEvent.click(add)
    await userEvent.click(add)
    await userEvent.click(add)
    expect(temp()).toBe('3')

    await enter(5)
    expect(preview()).toHaveTextContent('HP 12 → 10 · temp 3 → 0')

    await userEvent.click(screen.getByRole('button', { name: 'Take 5 damage' }))
    expect(current()).toBe('10')
    expect(temp()).toBe('0')
    expect(screen.getByRole('button', { name: /^Remove a temp/ })).toBeDisabled()
  })

  it('stops at 0 however hard the hit', async () => {
    show()

    await take(50)

    expect(current()).toBe('0')
    expect(meter().querySelector<HTMLElement>('.hp-bar-fill')?.style.width).toBe('0%')
  })

  it('fills the amount from a die the DM called and notes the roll in the log', async () => {
    fixRolls()
    show()

    await userEvent.click(screen.getByRole('button', { name: 'd6' }))
    expect(amount()).toHaveValue(4)
    expect(screen.getByText('rolled d6 [4]')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Take 4 damage' }))
    expect(log().getByText('Took 4 · d6 [4]')).toBeInTheDocument()
  })

  it('forgets the roll once the amount is typed over', async () => {
    fixRolls()
    show()

    await userEvent.click(screen.getByRole('button', { name: 'd6' }))
    await take(3)

    expect(screen.queryByText(/^rolled/)).not.toBeInTheDocument()
    expect(log().getByText('Took 3')).toBeInTheDocument()
  })
})

describe('healing (FR-8)', () => {
  it('switches the form over and starts the amount again', async () => {
    show()
    await enter(5)

    await chooseHeal()

    expect(modes().getByRole('button', { name: 'Heal' })).toHaveAttribute('aria-pressed', 'true')
    expect(modes().getByRole('button', { name: 'Take damage' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText('Healing received')).toHaveValue(null)
    expect(submit()).toHaveTextContent('Heal')
  })

  it('never heals past the maximum, and says so in the preview', async () => {
    show()
    await take(8)
    await chooseHeal()

    await enter(20)
    expect(preview()).toHaveTextContent('HP 4 → 12 · never above 12')

    await userEvent.click(screen.getByRole('button', { name: 'Heal 20' }))
    expect(current()).toBe('12')
    const [entry] = log().getAllByRole('listitem')
    expect(within(entry).getByText('+8')).toBeInTheDocument()
    expect(within(entry).getByText('Healed 20')).toBeInTheDocument()
  })

  it('does not log healing that changed nothing', async () => {
    show()
    await chooseHeal()

    await enter(5)
    await userEvent.click(screen.getByRole('button', { name: 'Heal 5' }))

    expect(log().getByText('Nothing yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo last' })).toBeDisabled()
  })

  it('spends a hit die for the roll plus Constitution, once', async () => {
    fixRolls()
    show()
    await take(10)
    await chooseHeal()

    await userEvent.click(screen.getByRole('button', { name: 'Roll d10' }))

    expect(current()).toBe('10')
    expect(within(meter()).getByText('Hit dice 0 / 1 · d10')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Roll d10' })).toBeDisabled()
    expect(log().getByText('Hit die d10 [6] +2')).toBeInTheDocument()
  })

  it('will not spend a hit die at full hit points', async () => {
    show()

    await chooseHeal()

    expect(screen.getByRole('button', { name: 'Roll d10' })).toBeDisabled()
  })
})

describe('undo and reset (FR-8)', () => {
  it('lists the newest step first and undoes it first', async () => {
    show()
    await take(3)
    await take(4)

    expect(log().getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '−4Took 49 → 5',
      '−3Took 312 → 9',
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Undo last' }))
    expect(current()).toBe('9')

    await userEvent.click(screen.getByRole('button', { name: 'Undo last' }))
    expect(current()).toBe('12')
    expect(log().getByText('Nothing yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo last' })).toBeDisabled()
  })

  it('resets to full, gives the hit die back and clears the log', async () => {
    fixRolls()
    show()
    await userEvent.click(screen.getByRole('button', { name: /^Add a temp/ }))
    await take(7)
    await chooseHeal()
    await userEvent.click(screen.getByRole('button', { name: 'Roll d10' }))

    await userEvent.click(screen.getByRole('button', { name: 'Reset to full' }))

    expect(current()).toBe('12')
    expect(temp()).toBe('0')
    expect(within(meter()).getByText('Hit dice 1 / 1 · d10')).toBeInTheDocument()
    expect(log().getByText('Nothing yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset to full' })).toBeDisabled()
  })
})

describe('closing the simulator', () => {
  it('closes from the corner button and from the footer', async () => {
    const onClose = show()

    for (const button of screen.getAllByRole('button', { name: 'Close' })) {
      await userEvent.click(button)
    }

    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('closes on escape without letting the dialog close itself', () => {
    const onClose = show()

    const cancel = new Event('cancel', { bubbles: true, cancelable: true })
    screen.getByRole('dialog', { name: 'Vex' }).dispatchEvent(cancel)

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(cancel.defaultPrevented).toBe(true)
  })

  it('closes on a backdrop click but not on a click inside the panel', async () => {
    const onClose = show()

    await userEvent.click(amount())
    expect(onClose).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('dialog', { name: 'Vex' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
