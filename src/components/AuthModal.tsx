import { useEffect, useRef } from "react";
import type { Mode } from "./LoginForm";
import { LoginForm } from "./LoginForm";
import { useAuth } from "../auth/useAuth";
import { FiX } from "react-icons/fi";

type AuthModalProps = {
  initialMode: Mode
  onClose: () => void
}

export function AuthModal({ initialMode, onClose }: AuthModalProps) {
  const { user } = useAuth()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  useEffect(() => {
    if (user) onClose()
  }, [user, onClose])

  return (
    <dialog
      ref={dialogRef} 
      className="modal" 
      aria-label="Account" 
      onCancel={(e) => {e.preventDefault(); onClose()}}
      onClick={(e) => {if (e.target === dialogRef.current) onClose()}}
    >
      <div className="modal-panel">
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          <FiX size={16} />
        </button>
        <LoginForm initialMode={initialMode} showWordmark={false} />
      </div>
    </dialog>
  )
}