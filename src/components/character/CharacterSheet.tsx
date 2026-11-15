import { useEffect, useRef, type ReactNode } from "react";
import { FiEdit2, FiPrinter, FiX } from "react-icons/fi";
import type { Ability, Character } from "../../characters/character";
import { formatModifier } from "../../characters/abilities";
import { CP_PER } from "../../characters/currency";
import { isComplete } from "../../characters/progress";
import { getBg, getClass, getEquipment, getRace, getSpell, type Spell } from "../../data/catalog";
import { fightingStyleName } from "../../data/classRules";
import { abilityRows, attackRows, derived, firstName, skillRows, spellDerived } from "./sheets";
import "./CharacterSheet.css"

const ABILITY_NAMES: Record<Ability, string> = {
  STR: 'Strength',
  DEX: 'Dexterity',
  CON: 'Constitution',
  INT: 'Intelligence',
  WIS: 'Wisdom',
  CHA: 'Charisma',
}

/** Lines per spell level, as the paper sheet prints them, and the column each level sits in. */
const SPELL_LINES = [8, 12, 13, 13, 13, 9, 9, 9, 7, 7]
const SPELL_COL = [[0, 1, 2], [3, 4, 5], [6, 7, 8, 9]]

const signed = (n: number | undefined) => (n === undefined ? '' : formatModifier(n))
const short = (ability: Ability) => ability.charAt(0) + ability.slice(1).toLowerCase()

/** Pads a list with blank rows so the sheet keeps its write-in lines. */
function pad<T>(items: T[], length: number): (T | null)[] {
  return [...items, ...Array<null>(Math.max(0, length - items.length)).fill(null)]
}

/** The purse is one copper total, the sheet splits it the way formatCoins does, so EP and PP stay blank */
function coins(cp: number): Record<'CP' | 'SP' | 'EP' | 'GP' | 'PP', string> {
  const gp = Math.floor(cp / CP_PER.GP)
  const sp = Math.floor((cp % CP_PER.GP) / CP_PER.SP)
  return { CP: String(cp % CP_PER.SP), SP: String(sp), EP: '', GP: String(gp), PP: ''}
}

/** The eq box: every kit grant and every purchase, merged by item, so two Daggers read "Dagger x2". */
function inventory(c: Character): string[] {
  const lines = new Map<string, { name: string; count: number}>()
  const add = (key: string, name: string, count: number) =>
    lines.set(key, { name, count: (lines.get(key)?.count ?? 0) + count })

  const grants = [...(c.equipmentChoice.class?.grants ?? []), ...(c.equipmentChoice.background?.grants ?? [])]
  for (const grant of grants) {
    const chosen = grant.choosableFrom && c.toolChoiceId && new RegExp(grant.choosableFrom).test(c.toolChoiceId)
    const item = getEquipment(grant.itemId ?? (chosen ? c.toolChoiceId! : ''))
    const name = item?.name ?? grant.text.replace(/^\d+\s+/, '')
    add(item?.id ?? name, name, grant.quantity)
  }

  for (const id of c.purchasedItemIds) {
    const item = getEquipment(id)
    if (item) add(id, item.name, 1)
  }

  return [...lines.values()].map(({ name, count }) => (count > 1 ? `${name} \u00d7${count}` : name))
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="sh-field">
      <span className="sh-value">{value ?? ''}</span>
      <span className="sh-label">{label}</span>
    </div>
  )
}

/** A framed box with its caption under it, as on the paper sheet. The caption comes first
 * in the markup so a screen reader hears the name before the contents. */
function Box({ label, className = '', children }: { label: string; className?: string; children?: ReactNode }) {
  return (
    <div className={`sh-box ${className}`}>
      <h3 className="sh-caption">{label}</h3>
      <div className="sh-box-body">{children}</div>
    </div>
  )
}

function Dot({ on, expert = false, label }: { on: boolean; expert?: boolean; label?: string }) {
  const name = label ?? (expert ? 'Expertise' : 'Proficient')
  return on ? (
    <span className={`sh-dot is-on${expert ? ' is-expert' : ''}`} role="img" aria-label={name} />
  ) : (
    <span className="sh-dot" aria-hidden="true" />
  )
}

function SpellLevel({ level, spells, slots }: { level: number; spells: Spell[]; slots: number }) {
  const lines = pad(spells, Math.max(SPELL_LINES[level], spells.length))
  return (
    <section className="sh-spell-level" aria-label={level === 0 ? 'Cantrips' : `Level ${level} spells`}>
      {level === 1 && (
        <p className="sh-spell-key" aria-hidden="true">
          <span>Spell level</span>
          <span>Slots total</span>
          <span>Slots expended</span>
        </p>
      )}
      <div className="sh-spell-head">
        <span className="sh-spell-num">{level}</span>
        {level === 0 ? (
          <span className="sh-spell-title">Cantrips</span>
        ) : (
          <>
            <span className="sh-spell-slot">{slots > 0 ? slots : ''}</span>
            <span className="sh-spell-slot" />
          </>
        )}
      </div>
      {level === 1 && (
        <p className="sh-spell-key sh-spell-key-under" aria-hidden="true">
          <span>Prepared</span>
          <span>Spell name</span>
        </p>
      )}
      <ul className="sh-spell-lines">
        {lines.map((spell, i) => (
          <li key={spell?.id ?? `blank-${i}`}>
            {level > 0 && <Dot on={spell !== null} label="Prepared" />}
            <span>{spell?.name}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function CharacterSheet({
  character,
  playerName,
  onClose,
  onEdit,
} : {
  character: Character
  playerName?: string | null
  onClose: () => void
  onEdit: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  const race = getRace(character.raceId)
  const cls = getClass(character.classId)
  const bg = getBg(character.backgroundId)
  const d = derived(character)
  const spell = spellDerived(character)
  const done = isComplete(character)

  const purse = coins(character.walletCp)
  const spells = character.spellIds.flatMap((i) => getSpell(i) ?? [])
  const isCaster = cls !== undefined && cls.casterType !== 'NONE'
  const style = fightingStyleName(character.fightingStyleId)
  const tool = character.toolChoiceId ? getEquipment(character.toolChoiceId)?.name : bg?.tool.text

  const features = [
    ...(race?.traits ?? []).map((t) => ({ name: t.name, from: race?.name })),
    ...(cls?.features ?? []).map((f) => ({ name: f.name, from: cls?.name })),
    ...(style ? [{ name: `Fighting Style: ${style}`, from: cls?.name }]: []),
    ...(bg?.featName ? [{ name: bg.featName, from: bg.name}] : []),
  ]

  const proficiencies = [
    ['Armor', cls?.proficiencies.armor],
    ['Weapons', cls?.proficiencies.weapons],
    ['Tools', tool],
  ].filter(([, value]) => value)

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-sheet"
      aria-labelledby="sheet-title"
      onCancel={(e) => {e.preventDefault(); onClose()}}
      onClick={(e) => {if (e.target === dialogRef.current) onClose()}}
    >
      <div className="sheet-toolbar">
        <h2 id="sheet-title">{character.name}</h2>
        <div className="sheet-actions">
          <button type="button" className="btn btn-quiet" onClick={onEdit}>
            <FiEdit2 size={15} aria-hidden="true" /> Edit
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!done}
            title={done ? undefined : 'Finish the character to export its sheet'}
            onClick={() => window.print()}
          >
            <FiPrinter size={15} aria-hidden="true" /> Print or save as PDF
          </button>
          <button type="button"className="btn btn-quiet sheet-close" aria-label="Close" onClick={onClose}>
            <FiX size={16} />
          </button>
        </div>
      </div>

      <div className="sheet-scroll">
        <div className="sheet">
          {/* Page 1: The character */}
          <article className="sh-page" aria-label="Character">
            <header className="sh-head">
              <div className="sh-banner">
                <span className="sh-value sh-name">{character.name}</span>
                <span className="sh-label">Character name</span>
              </div>
              <div className="sh-head-fields">
                <Field label="Class & level" value={cls && `${cls.name} ${character.level}`} />
                <Field label="Background" value={bg?.name} />
                <Field label="Player name" value={firstName(playerName)} />
                <Field label="Race" value={race?.name} />
                <Field label="Alignment" />
                <Field label="Experience points" />
              </div>
            </header>

            <div className="sh-body">
              <div className="sh-col">
                <div className="sh-core">
                  <ul className="sh-abilities" aria-label="Ability scores">
                    {abilityRows(character).map((row) => (
                      <li className="sh-ability" key={row.ability}>
                        <span className="sh-label">{ABILITY_NAMES[row.ability]}</span>
                        <span className="sh-ability-mod">{signed(row.modifier)}</span>
                        <span className="sh-ability-score">{row.total ?? ''}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="sh-core-right">
                    <div className="sh-pill sh-pill-square">
                      <span className="sh-pill-value" />
                      <span className="sh-label">Inspiration</span>
                    </div>
                    <div className="sh-pill">
                      <span className="sh-pill-value">{formatModifier(d.proficiencyBonus)}</span>
                      <span className="sh-label">Proficiency bonus</span>
                    </div>

                    <Box label="Saving throws" className="sh-list sh-saves">
                      <ul>
                        {d.savingThrows.map((save) => (
                          <li key={save.ability}>
                            <Dot on={save.proficient} />
                            <span className="sh-list-value">{formatModifier(save.modifier)}</span>
                            <span>{ABILITY_NAMES[save.ability]}</span>
                          </li>
                        ))}
                      </ul>
                    </Box>

                    <Box label="Skills" className="sh-list sh-skills">
                      <ul>
                        {skillRows(character).map((sk) => (
                          <li key={sk.id}>
                            <Dot on={sk.source !== null} expert={sk.source?.expert} />
                            <span className="sh-list-value">{signed(sk.bonus)}</span>
                            <span>
                              {sk.name} <span className="sh-abbr">({short(sk.ability)})</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="sh-key" aria-hidden="true">
                        <span><span className="sh-dot is-on" /> Proficient</span>
                        <span><span className="sh-dot is-on is-expert" /> Expertise</span>
                      </p>
                    </Box>
                  </div>
                </div>

                <div className="sh-pill sh-pill-wide">
                  <span className="sh-pill-value">{d.passivePerception ?? ''}</span>
                  <span className="sh-label">Passive Wisdom (Perception)</span>
                </div>

                <Box label="Other proficiencies & languages" className="sh-grow">
                  {proficiencies.map(([label, value]) => (
                    <p key={label}>
                      <strong>{label}.</strong> {value}
                    </p>
                  ))}
                </Box>
              </div>

              <div className="sh-col">
                <div className="sh-panel sh-combat">
                  <div className="sh-combat-row">
                    <div className="sh-stat sh-shield">
                      <span className="sh-stat-value">{d.armorClass ?? ''}</span>
                      <span className="sh-label">Armor class</span>
                    </div>
                    <div className="sh-stat">
                      <span className="sh-stat-value">{signed(d.initiative)}</span>
                      <span className="sh-label">Initiative</span>
                    </div>
                    <div className="sh-stat">
                      <span className="sh-stat-value">{d.speed ?? ''}</span>
                      <span className="sh-label">Speed</span>
                    </div>
                  </div>

                  <Box label="Current hit points" className="sh-hp-current">
                    <p className="sh-hint">
                      Hit Point Maximum <span className="sh-hint-value">{d.hitPoints ?? ''}</span>
                    </p>
                  </Box>
                  <Box label="Temporary hit points" className="sh-hp-temp" />

                  <div className="sh-combat-row sh-combat-row-2">
                    <Box label="Hit dice">
                      <p className="sh-hint">
                        Total <span className="sh-hint-value">{cls ? `${character.level}d${cls.hitDie}` : ''}</span>
                      </p>
                    </Box>
                    <Box label="Death saves">
                      <div className="sh-death">
                        {['Successes', 'Failures'].map((i) => (
                          <p key={i}>
                            <span className="sh-label">{i}</span>
                            <span className="sh-death-marks" aria-hidden="true">
                              <span /><span /><span />
                            </span>
                          </p>
                        ))}
                      </div>
                    </Box>
                  </div>
                </div>

                <Box label="Attacks & spellcasting" className="sh-attacks">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Name</th>
                        <th scope="col">Atk bonus</th>
                        <th scope="col">Damage/type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pad(attackRows(character), 3).map((atk, i) => (
                        <tr key={atk?.id ?? `blank-${i}`}>
                          <td>{atk?.name}</td>
                          <td>{atk?.bonus}</td>
                          <td>{atk?.damage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>

                <Box label="Equipment" className="sh-equipment">
                  <ul className="sh-coins" aria-label="Coins">
                    {(['CP', 'SP', 'EP', 'GP', 'PP'] as const).map((c) => (
                      <li key={c}>
                        <span className="sh-label">{c}</span>
                        <span className="sh-coin-value">{purse[c]}</span>
                      </li>
                    ))}
                  </ul>
                  <ul className="sh-items">
                    {inventory(character).map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </Box>
              </div>

              <div className="sh-col">
                <div className="sh-panel sh-traits">
                  <Box label="Personality traits" className="sh-personality" />
                  <Box label="Ideals" />
                  <Box label="Bonds" />
                  <Box label="Flaws" />
                </div>

                <Box label="Features & traits" className="sh-grow">
                  <ul className="sh-features">
                    {features.map((ft) => (
                      <li key={`${ft.from}-${ft.name}`}>
                        <strong>{ft.name}</strong> <span className="sh-abbr">{ft.from}</span>
                      </li>
                    ))}
                  </ul>
                </Box>
              </div>
            </div>
          </article>

          {/* Page 2: The person */}
          <article className="sh-page" aria-label="Appearance and backstory">
            <header className="sh-head">
              <div className="sh-banner">
                <span className="sh-value sh-name">{character.name}</span>
                <span className="sh-label">Character name</span>
              </div>
              <div className="sh-head-fields">
                <Field label="Age" />
                <Field label="Height" />
                <Field label="Weight" />
                <Field label="Eyes" />
                <Field label="Skin" />
                <Field label="Hair" />
              </div>
            </header>

            <div className="sh-body sh-body-2">
              <Box label="Character appearance" className="sh-appearance" />
              <Box label="Allies & organizations" className="sh-allies">
                <div className="sh-symbol">
                  <span className="sh-label">Name</span>
                  <span className="sh-symbol-name" />
                  <span className="sh-symbol-art" />
                  <span className="sh-label sh-symbol-caption">Symbol</span>
                </div>
              </Box>
              <Box label="Character backstory" className="sh-backstory" />
              <Box label="Additional features & traits" className="sh-additional" />
              <Box label="Treasure"className="sh-treasure" />
            </div>
          </article>

          {/* Page 3: Spells */}
          <article className="sh-page" aria-label="Spellcasting">
            <header className="sh-head">
              <div className="sh-banner">
                <span className="sh-value sh-name">{isCaster ? cls.name : ''}</span>
                <span className="sh-label">Spellcasting class</span>
              </div>
              <div className="sh-head-stats">
                <div className="sh-head-stat">
                  <span className="sh-stat-box">{spell.ability ? ABILITY_NAMES[spell.ability] : ''}</span>
                  <span className="sh-label">Spellcasting ability</span>
                </div>
                <div className="sh-head-stat">
                  <span className="sh-stat-box">{spell.saveDC ?? ''}</span>
                  <span className="sh-label">Spell save DC</span>
                </div>
                <div className="sh-head-stat">
                  <span className="sh-stat-box">{signed(spell.attackBonus)}</span>
                  <span className="sh-label">Spell attack bonus</span>
                </div>
              </div>
            </header>

            <div className="sh-spells">
              {SPELL_COL.map((lvls) => (
                <div className="sh-spell-col" key={lvls[0]}>
                  {lvls.map((lv) => (
                    <SpellLevel
                      key={lv}
                      level={lv}
                      spells={spells.filter((s) => s.level === lv)}
                      slots={lv === 1 ? spell.slots : 0}
                    />
                    ))}
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </dialog>
  )
}