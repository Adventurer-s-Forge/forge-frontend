import { useEffect, useRef } from "react";
import type { Mode } from "./LoginForm";
import { LoginForm } from "./LoginForm";
import { useAuth } from "../auth/useAuth";

type AuthModalProps = {
  initialMode: Mode
  onClose: () => void
}

export function AuthModal({ initialMode, onClose }: AuthModalProps) {
  const { user } = useAuth()
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user) onClose()
  }, [user, onClose])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className="modal-panel">
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          &times;
        </button>
        <LoginForm initialMode={initialMode} />
      </div>
    </div>
  )
}