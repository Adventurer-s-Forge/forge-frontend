import { useEffect, useRef, useState } from "react";

type ConfirmDeleteProps = {
  title: string
  body: string
  confirmLabel: string
  busyLabel: string
  onConfirm: () => Promise<void> | void
  onClose: () => void
}

export function ConfirmDelete({
  title,
  body,
  confirmLabel,
  busyLabel,
  onConfirm,
  onClose,
} : ConfirmDeleteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  async function handleConfirm() {
    setError(null)
    setBusy(true)

    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.")
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="confirm-title"
      onCancel={(e) => {e.preventDefault(); onClose()}}
      onClick={(e) => {if (e.target === dialogRef.current) onClose()}}
    >
      <div className="modal-panel confirm">
        <h2 id="confirm-title">{title}</h2>
        <p className="muted">{body}</p>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="confirm-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={handleConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}