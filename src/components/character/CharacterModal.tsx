import React, { useEffect, useRef, useState } from "react";
import type { Character, StepId } from "../../characters/character";
import { STEPS, createDraft } from "../../characters/character";
import {
  completeStep,
  isStepReachable,
  isStepValid,
  firstIncompleteStep,
} from "../../characters/progress";
import {
  AttributeStep,
  BackgroundStep,
  ClassStep,
  EquipmentStep,
  NameStep,
  RaceStep,
  SkillsStep,
} from "./steps";
import type { StepProps } from "./steps";
import { FiX } from "react-icons/fi";

const PANELS: Record<StepId, (props: StepProps) => React.ReactElement> = {
  name: NameStep,
  race: RaceStep,
  class: ClassStep,
  background: BackgroundStep,
  attributes: AttributeStep,
  skills: SkillsStep,
  equipment: EquipmentStep,
}

type CharacterModalProps = {
  character?: Character
  onSave: (character: Character) => Promise<Character>
  onClose: () => void
}

export function CharacterModal({ character, onSave, onClose }: CharacterModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState<Character>(() => character ?? createDraft())
  const [step, setStep] = useState<StepId>(() => (character && firstIncompleteStep(character)) ?? 'name')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  const index = STEPS.findIndex((s) => s.id === step)
  const isLast = index === STEPS.length - 1
  const canContinue = isStepValid(step, draft)
  const Panel = PANELS[step]

  async function handleContinue() {
    const confirmed = completeStep(draft, step)
    setDraft(confirmed)
    setError(null)

    setSaving(true)
    try {
      const saved = await onSave(confirmed)
      setDraft(saved)
      if (isLast) return onClose()
      setStep(STEPS[index + 1].id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your character.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-wide"
      aria-label="Create character"
      onCancel={(e) => { e.preventDefault(); onClose()}}
      onClick={(e) => {if (e.target === dialogRef.current) onClose()}}
    >
      <div className="modal-panel wizard">
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          <FiX size={16} />
        </button>

        <header className="wizard-head">
          <h2>{draft.name.trim() || 'New character'}</h2>
        </header>

        <div className="wizard-tabs" role="tablist" aria-label="Creation steps">
          {STEPS.map(({ id, label}, i) => {
            const reachable = isStepReachable(id, draft)
            const done = draft.completedSteps.includes(id) && isStepValid(id, draft)

            return (
              <button
                type="button"
                role="tab"
                key={id}
                id={`tab-${id}`}
                aria-selected={id === step}
                aria-controls="wizard-panel"
                className={`wizard-tab${id === step ? ' is-active' : ''}${done ? ' is-done' : ''}`}
                disabled={!reachable && id !== step}
                onClick={() => setStep(id)}
              >
                <span className="wizard-tab-index">{i + 1}</span>
                {label}
              </button>
            )
          })}
        </div>

        <div className="wizard-panel" id="wizard-panel" role="tabpanel" aria-labelledby={`tab-${step}`}>
          <Panel character={draft} onChange={setDraft} />
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <footer className="wizard-foot">
          <button type="button" className="btn btn-quiet" disabled={index === 0 || saving} onClick={() => setStep(STEPS[index - 1].id)}>
            Back
          </button>
          <button type="button" className="btn btn-primary" disabled={!canContinue || saving} onClick={handleContinue}>
            {saving ? 'Saving...' : isLast ? 'Finish' : 'Continue'}
          </button>
        </footer>
      </div>
    </dialog>
  )
}