import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDelete } from "../components/ConfirmDelete";

type Props = Parameters<typeof ConfirmDelete>[0]

function renderDialog(overrides: Partial<Props> = {}) {
  const props: Props = {
    title: 'Delete Arkes?',
    body: 'This cannot be undone.',
    confirmLabel: 'Delete character',
    busyLabel: 'Deleting...',
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  render(<ConfirmDelete {...props} />)
  return props
}

describe('ConfirmDelete', () => {
  it('shows the title and body', () => {
    renderDialog()
    expect(screen.getByRole('heading', { name: 'Delete Arkes?' })).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
  })

  it('closes without confirming when cancelled', async () => {
    const { onClose, onConfirm } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('confirms, then closes', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const { onClose } = renderDialog({ onConfirm })

    await userEvent.click(screen.getByRole('button', { name: 'Delete character' }))
    
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalled()
  })

  it('disables both button while the deletion is in flight', async () => {
    let release: () => void = () => {}
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => { release = resolve }))
    renderDialog({ onConfirm })

    await userEvent.click(screen.getByRole('button', { name: 'Delete character' }))

    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

    await act(async () => release())
  })

  it('surfaces a failure and stays open for a retry', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Network unreachable'))
    const { onClose } = renderDialog({ onConfirm })

    await userEvent.click(screen.getByRole('button', { name: 'Delete character' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Network unreachable')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Delete character' })).toBeEnabled()
  })
})