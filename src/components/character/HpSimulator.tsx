import { useEffect, useRef, useState } from "react";
import { FiX } from "react-icons/fi";
import type { Character } from "../../characters/character";
import { abilityModifier, finalScores, formatModifier } from "../../characters/abilities";
import { 
  heal,
  record,
  rollDie,
  setTemp,
  spendHitdie,
  startSession,
  takeDmg,
  undo,
} from "../../characters/hitPoints";
import { getBg, getClass, getRace } from "../../data/catalog";
import { derived } from "./sheets";

const DICE = [4, 6, 8, 10, 12] as const

type Mode = 'damage' | 'heal'

export function HpSimulator({ character, onClose }: { character: Character; onClose: () => void}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cls = getClass(character.classId)
  const con = finalScores(character.abilities.base, character.abilities.originBonuses).CON
  const conMod = con === undefined ? 0 : abilityModifier(con)
  const max = derived(character).hitPoints ?? 0
  const hitDie = cls?.hitDie ?? 0

  const [session, setSession] = useState(() => startSession(max, character.level))
  const [mode, setMode] = useState<Mode>('damage')
  const [amount, setAmount] = useState('')
  const [rolled, setRolled] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  const hp = session.state
  const points = Number(amount)
  const valid = amount !== '' && Number.isInteger(points) && points > 0
  const preview = !valid ? null : mode === 'damage' ? takeDmg(hp, points) : heal(hp, points)
  const percent = max > 0 ? Math.round((hp.current / max) * 100) : 0
  const summary = [getRace(character.raceId)?.name, cls?.name, getBg(character.backgroundId)?.name].filter(Boolean).join(' · ')

  function switchMode(next: Mode) {
    setMode(next)
    setAmount('')
    setRolled(null)
  }

  // Dice are roleld outside the state updated, so a re-run of the updater cannot re-roll.
  function roll(sides: number) {
    const value = rollDie(sides)
    setAmount(String(value))
    setRolled(`d${sides} [${value}]`)
  }

  function apply() {
    if (!valid) return
    const label = mode === 'damage' ? `Took ${points}${rolled ? ` · ${rolled}` : ''}` : `Healed ${points}`
    setSession((s) => record(s, label, mode === 'damage' ? takeDmg(s.state, points) : heal(s.state, points)))
    setAmount('')
    setRolled(null)
  }

  function spendDie() {
    const value = rollDie(hitDie)
    const label = `Hit die d${hitDie} [${value}] ${formatModifier(conMod)}`
    setSession((s) => record(s, label, spendHitdie(s.state, value, conMod)))
  }

  const changeTemp = (by: number) => 
    setSession((s) => record(s, `Temp HP ${by > 0 ? '+' : '\u2212'}1`, setTemp(s.state, s.state.temp + by)))

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-hp"
      aria-labelledby="hp-title"
      onCancel={(e) => {e.preventDefault(); onClose()}}
      onClick={(e) => {if (e.target === dialogRef.current) onClose()}}
    >
      <div className="modal-panel wizard">
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          <FiX size={16} />
        </button>

        <header className="wizard-head">
          <h2 id="hp-title">{character.name}</h2>
          <p className="wizard-sub">
            HP Simulator{summary && ` · ${summary}`} ·{' '}
            <span className="hp-practice">practice only, nothing is saved</span>
          </p>
        </header>

        <div className="hp-body">
          <div className="hp-main">
            <section className="hp-meter" aria-label="Hit points">
              <div className="hp-meter-row">
                <p className="hp-eyebrow">Hit points</p>
                <p className="hp-eyebrow">
                  Hit dice {hp.hitDiceLeft} / {character.level} · d{hitDie}
                </p>
              </div>

              <div className="hp-meter-row">
                <p className="hp-count" aria-live="polite">
                  <span className="hp-current">{hp.current}</span>
                  <span className="hp-max">/ {max}</span>
                </p>

                <div className="hp-temp">
                  <span className="hp-eyebrow">Temp HP</span>
                  <span className="stepper">
                    <button
                      type="button"
                      aria-label="Remove a temporary hit point"
                      disabled={hp.temp === 0} onClick={() => changeTemp(-1)}
                    >&minus;</button>
                    <span>{hp.temp}</span>
                    <button type="button" aria-label="Add a temp hit point" onClick={() => changeTemp(1)}>
                      +
                    </button>
                  </span>
                </div>
              </div>

              <div className="hp-bar" aria-hidden="true">
                <div className="hp-bar-fill" style={{ width: `${percent}%` }} />
              </div>

              {hp.current === 0 && (
                <p className="hp-down" role="status">
                  At 0 hit points the character falls unconscious. Death saves are not simulated.
                </p>
              )}
            </section>

            <div className="chip-row" role="group" aria-label="Action">
              <button
                type="button"
                className={`chip${mode === 'damage' ? ' is-chosen' : ''}`}
                aria-pressed={mode === 'damage'}
                onClick={() => switchMode('damage')}
              >Take damage</button>
              <button
                type="button"
                className={`chip${mode === 'heal' ? ' is-chosen' : ''}`}
                aria-pressed={mode === 'heal'}
                onClick={() => switchMode('heal')}
              >Heal</button>
            </div>

            {mode === 'heal' && (
              <div className="hp-rest">
                <div>
                  <p className="hp-eyebrow">Spend a hit die · short rest</p>
                  <p className="muted">
                    d{hitDie} {formatModifier(conMod)} CON · {hp.hitDiceLeft} of {character.level} left
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-quiet"
                  disabled={hp.hitDiceLeft === 0 || hp.current === max}
                  onClick={spendDie}
                >Roll d{hitDie}</button>
              </div>
            )}

            <form className="hp-form" onSubmit={(e) => {e.preventDefault(); apply()}}>
              <div className="hp-field">
                <label htmlFor="hp-amount">{mode === 'damage' ? 'Damage taken' : 'Healing received'}</label>
                <input
                  id="hp-amount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={(e) => {setAmount(e.target.value); setRolled(null)}}
                />
              </div>

              {mode === 'damage' && (
                <div className="hp-dice" role="group" aria-label="Roll what the DM called">
                  <p className="hp-eyebrow">Or roll what the DM called</p>
                  {DICE.map((sides) => (
                    <button type="button" className="chip" key={sides} onClick={() => roll(sides)}>
                      d{sides}
                    </button>
                  ))}
                  {rolled && <span className="muted">rolled {rolled}</span>}
                </div>
              )}

              <div className="hp-apply">
                <p className="hp-preview">
                  {preview ? (
                    <>
                      HP {hp.current} &rarr; <strong>{preview.current}</strong>
                      {preview.temp !== hp.temp && ` · temp ${hp.temp} \u2192 ${preview.temp}`}
                      {mode === 'heal' && ` · never above ${max}`}
                    </>
                  ) : (
                    '\u00a0'
                  )}
                </p>
                <button type="submit" className={mode === 'damage' ? 'btn btn-danger' : 'btn btn-primary'} disabled={!valid}>
                  {mode === 'damage'
                    ? valid ? `Take ${points} damage` : 'Take damage'
                    : valid ? `Heal ${points}` : 'Heal'}
                </button>
              </div>
            </form>
          </div>

          <aside className="hp-log" aria-label="This session">
            <div className="hp-meter-row">
              <p className="hp-eyebrow">This session</p>
              <button type="button" className="btn btn-quiet" disabled={session.log.length === 0} onClick={() => setSession(undo)}>
                Undo last
              </button>
            </div>

            {session.log.length === 0 ? (
              <p className="muted">Nothing yet.</p>
            ) : (
              <ol className="hp-log-list">
                {session.log.map((e, i) => {
                  const delta = e.after.current - e.before.current
                  return (
                    <li key={session.log.length - i}>
                      <span className={`hp-delta${delta < 0 ? ' is-loss' : ''}`}>
                        {delta > 0 ? `+${delta}` : delta < 0 ? `\u2212${-delta}` : '\u2014'}
                      </span>
                      <span>{e.label}</span>
                      <span className="hp-eyebrow">
                        {e.before.current} &rarr; {e.after.current}
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}

            <p className="muted hp-log-note">Nothing here is saved. Closing resets HP to full and clears this list.</p>
          </aside>
        </div>

        <footer className="hp-foot">
          <p className="hp-eyebrow">Always starts at full · {max} / {max}</p>
          <div className="hp-foot-actions">
            <button 
              type="button"
              className="btn btn-quiet"
              disabled={session.log.length === 0}
              onClick={() => setSession(startSession(max, character.level))}>
                Reset to full
              </button>
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Close
              </button>
          </div>
        </footer>
      </div>
    </dialog>
  )
}