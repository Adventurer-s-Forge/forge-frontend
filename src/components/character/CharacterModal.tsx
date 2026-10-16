import React, { useEffect, useRef, useState } from "react";
import type { Character, StepId } from "../../characters/character";
import { STEPS, createDraft } from "../../characters/character";
import {
  completeStep,
  isStepReachable,
  isStepValid,
  firstIncompleteStep,
  nextStep,
  prevStep,
  isStepApplicable,
} from "../../characters/progress";
import {
  AttributeStep,
  BackgroundStep,
  ClassStep,
  EquipmentStep,
  NameStep,
  RaceStep,
  SkillsStep,
  SpellsStep,
} from "./steps";
import type { StepProps } from "./steps";
import { FiX } from "react-icons/fi";
import { getBg, getClass, getRace } from "../../data/catalog";

const PANELS: Record<StepId, (props: StepProps) => React.ReactElement> = {
  name: NameStep,
  race: RaceStep,
  class: ClassStep,
  background: BackgroundStep,
  attributes: AttributeStep,
  skills: SkillsStep,
  spells: SpellsStep,
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
  const [exiting, setExiting] = useState(false)

  const savedRef = useRef(JSON.stringify(character ?? null))

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  const next = nextStep(draft, step)
  const prev = prevStep(draft, step)
  const isLast = next === null
  const canContinue = isStepValid(step, draft)
  const Panel = PANELS[step]

  async function flush(doc: Character): Promise<boolean> {
    if (doc.name.trim() === '' || JSON.stringify(doc) === savedRef.current) return true

    setSaving(true)
    try {
      const saved = await onSave(doc)
      setDraft(saved)
      savedRef.current = JSON.stringify(saved)
      setError(null)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your character.")
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleContinue() {
    const confirmed = completeStep(draft, step)
    setDraft(confirmed)
    setError(null)

    // POST on the name step so char exists and can be resumed, then one
    // PUT at the end. There are no PUTS from steps 2-7 now

    const shouldSave = step === 'name' || next === null
    if (shouldSave && !(await flush(confirmed))) return

    if (next) setStep(next)
    else onClose()
  }

  function isDirty(doc: Character) {
    return doc.name.trim() !== '' && JSON.stringify(doc) !== savedRef.current
  }

  function requestClose() {
    if (!isDirty(draft)) return onClose()
    setExiting(true)
  }

  async function saveAndClose() {
    if (await flush(draft)) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-wide"
      aria-label="Create character"
      onCancel={(e) => { e.preventDefault(); if (exiting) setExiting(false); else requestClose()}}
      onClick={(e) => { if (e.target === dialogRef.current) requestClose() }}
    >
      <div className="modal-panel wizard">
        <button type="button" className="modal-close" aria-label="Close" disabled={saving} onClick={requestClose}>
          <FiX size={16} />
        </button>

        <header className="wizard-head">
          <h2>{draft.name.trim() || 'New character'}</h2>
          <p className="wizard-sub">
            {[getRace(draft.raceId)?.name, getClass(draft.classId)?.name, getBg(draft.backgroundId)?.name]
              .filter(Boolean)
              .join(' \u00b7 ') || 'Pick a race, class and background'}
          </p>
        </header>

        <div className="wizard-tabs" role="tablist" aria-label="Creation steps">
          {STEPS.map(({ id, label}, i) => {
            const applicable = isStepApplicable(id, draft)
            const reachable = isStepReachable(id, draft)
            const done = applicable && draft.completedSteps.includes(id) && isStepValid(id, draft)

            return (
              <button
                type="button"
                role="tab"
                key={id}
                id={`tab-${id}`}
                aria-selected={id === step}
                aria-controls="wizard-panel"
                aria-disabled={!applicable}
                className={`wizard-tab${id === step ? ' is-active' : ''}${done ? ' is-done' : ''}${applicable ? '' : ' is-unavailable'}`}
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
          {exiting ? (
            <>
              <p className="wizard-exit-msg">
                Your later steps haven&rsquo;t been saved yet.
              </p>
              <div className="wizard-exit-actions">
                <button type="button" className="btn btn-quiet" disabled={saving}
                  onClick={() => setExiting(false)}>
                    Keep editing
                </button>
                <button type="button" className="btn btn-quiet" disabled={saving}
                  onClick={onClose}>
                    Discard
                </button>
                <button type="button" className="btn btn-primary" disabled={saving}
                  autoFocus onClick={() => void saveAndClose()}>
                    {saving ? 'Saving\u2026' : 'Save and close'}
                </button>
              </div>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-quiet" disabled={prev === null || saving}
                onClick={() => prev && setStep(prev)}>
                  Back
              </button>
              <button type="button" className="btn btn-primary" disabled={!canContinue || saving}
                onClick={handleContinue}>
                {saving ? 'Saving\u2026' : isLast ? 'Finish' : 'Continue'}
              </button>
            </>
          )}
        </footer>
      </div>
    </dialog>
  )
}