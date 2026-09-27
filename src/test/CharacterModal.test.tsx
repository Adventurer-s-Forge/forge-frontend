import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, it, vi } from "vitest";
import { createDraft } from "../characters/character";
import type { Character } from "../characters/character";
import { CharacterModal } from "../components/character/CharacterModal";
import { seedTestCatalog } from './fixtures'
import { completeStep } from "../characters/progress";

beforeAll(seedTestCatalog)

function renderModal(character?: Character) {
  const onSave = vi.fn(async (c: Character) => c)
  const onClose = vi.fn()
  render(<CharacterModal character={character} onSave={onSave} onClose={onClose} />)
  return { onSave, onClose }
}

describe('CharacterModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows all seven steps as tabs', () => {
    renderModal()
    expect(screen.getAllByRole('tab')).toHaveLength(7)
  })

  it('locks every step beyond the first for a new draft', () => {
    renderModal()

    expect(screen.getByRole('tab', { name: /Name/ })).toBeEnabled()
    expect(screen.getByRole('tab', { name: /Race/ })).toBeDisabled()
    expect(screen.getByRole('tab', { name: /Equipment|Items/ })).toBeDisabled()
  })

  it('keeps Continue disabled until the step is valid', async () => {
    renderModal()

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Character name'), 'Arkes')

    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('saves and advances when the step is confirmed', async () => {
    const { onSave } = renderModal()

    await userEvent.type(screen.getByLabelText('Character name'), 'Arkes')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toMatchObject({
      name: 'Arkes',
      completedSteps: ['name'],
    })
    expect(screen.getByRole('tab', { name: /Race/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('goes back to the previous step', async () => {
    renderModal()

    await userEvent.type(screen.getByLabelText('Character name'), 'Arkes')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByRole('tab', { name: /Name/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('disables Back on the first step', () => {
    renderModal()
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
  })

  it('resumes an existing character at its first unconfirmed step', () => {
    const resumed: Character = {
      ...createDraft(),
      name: 'Arkes',
      raceId: 'srd_half-orc',
      completedSteps: ['name'],
    }
    renderModal(resumed)

    expect(screen.getByRole('tab', { name: /Race/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('uses the character name as the heading once it has one', () => {
    renderModal({ ...createDraft(), name: 'Arkes' })
    expect(screen.getByRole('heading', { name: 'Arkes' })).toBeInTheDocument()
  })

  it('falls back to a placeholder heading for an unnamed draft', () => {
    renderModal()
    expect(screen.getByRole('heading', { name: 'New character' })).toBeInTheDocument()
  })

  it('surfaces a save failure and stays on tehe step', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Storage unavailable'))
    render(<CharacterModal onSave={onSave} onClose={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Character name'), 'Arkes')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable')
    expect(screen.getByRole('tab', { name: /Name/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('closes when dismissed', async () => {
    const { onClose } = renderModal()

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalled()
  })
})