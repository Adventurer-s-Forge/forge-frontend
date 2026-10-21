import type { Ability, AbilityMethod, AbilityScores, Character } from "../../characters/character";
import { 
  ABILITIES,
  ORIGIN_TOTAL,
  POINT_BUY_BUDGET,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  STD_ARR,
  formatModifier,
  originSpreadValid,
  pointBuySpent,
  rollAbilityPool,
} from "../../characters/abilities";
import {
  buyItem,
  isStepApplicable,
  resetMarket,
  sellItem,
  setAbilityMethod,
  setAbilityScore,
  setBackground,
  setClass,
  setEquipmentChoice,
  setFightingStyle,
  setName,
  setOriginBonuses,
  setRace,
  setRolledPool,
  setSizeChoice,
  toggleExpertise,
  toggleSkill,
  toggleSpell,
} from "../../characters/progress";
import {
  catalog,
  classSkillOptions,
  expertiseCounts,
  getBg,
  getClass,
  getRace,
  getSkill,
  getSpell,
  purchaseableEquipment,
  spellBudget,
  spellOptions,
} from "../../data/catalog";
import { abilityRows, armorStealthDisadvantage, derived, purseCp, skillRows, spellDerived, spentCp } from "./sheets";
import { FiArrowRight, FiCheck, FiCheckCircle, FiX } from "react-icons/fi";
import { useState } from "react";
import { ConfirmDelete } from "../ConfirmDelete";
import { formatCoins } from "../../characters/currency";
import { Markdown } from "../Markdown";
import { FIGHTING_STYLES } from "../../data/classRules";

export type StepProps = {
  character: Character
  onChange: (next: Character) => void
}

export function NameStep({ character, onChange }: StepProps) {
  return (
    <div className="step">
      <label htmlFor="character-name">Character name</label>
      <input
        id="character-name"
        type="text"
        autoFocus
        value={character.name}
        placeholder="Arkes Doomhammer"
        onChange={(e) => onChange(setName(character, e.target.value))}
      />
      <p className="step-hint">You can change this at any time</p>
    </div>
  )
}

export function RaceStep({ character, onChange }: StepProps) {
  const chosen = getRace(character.raceId)
  const size = character.sizeChoice ?? chosen?.sizes[0] ?? null

  return (
    <div className="step">
      <p className="step-intro">
        Pick a race. Its detail open below so you can compare before moving on; picking another swaps the panel.
      </p>

      <fieldset className="pick-set">
        <legend>Race &mdash; {chosen ? 1 : 0} of {catalog.races.length}</legend>
        <div className="pick-grid" role="radiogroup" aria-label="Race">
          {catalog.races.map((race) => {
            const picked = character.raceId === race.id
            const sizeLabel = race.sizes.length === 1 && race.sizes[0] === 'Small' ? 'Small' : `Speed ${race.speed}`
            const senseLabel = race.darkvisionFt ? `Darkv. ${race.darkvisionFt}` : (race.traits[0]?.name ?? '')

            return (
              <button
                type="button"
                role="radio"
                aria-checked={picked}
                className={`pick-tile${picked ? ' is-chosen' : ''}`}
                key={race.id}
                onClick={() => onChange(setRace(character, race.id))}
              >
                <span className="pick-tile-name">
                  {race.name}
                  {picked && (
                    <span className="pick-check" aria-hidden="true">
                      <FiCheck size={14} />
                    </span>
                  )}
                </span>
                <span className="pick-tile-meta">
                  {[sizeLabel, senseLabel].filter(Boolean).join(' · ')}
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      {chosen && (
        <section className="detail-panel" aria-labelledby="selected-race">
          <div className="detail-head">
            <div>
              <p className="detail-eyebrow">Selected race</p>
              <h3 className="detail-title" id="selected-race">{chosen.name}</h3>
            </div>
            <button type="button" className="btn btn-quiet" onClick={() => onChange(setRace(character, null))}>
              Clear
            </button>
          </div>

          <div className="detail-body">
            <div className="stat-grid">
              <div className="stat-card">
                <p className="stat-card-label">Size</p>
                {chosen.sizes.length > 1 ? (
                  <div className="chip-row">
                    {chosen.sizes.map((option) => (
                      <button
                        type="button"
                        className={`chip${size === option ? ' is-chosen' : ''}`}
                        key={option}
                        aria-pressed={size === option}
                        onClick={() => onChange(setSizeChoice(character, option))}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="stat-card-row">
                    <span>Size</span>
                    <span className="stat-card-value">{chosen.sizes[0]}</span>
                  </div>
                )}
                {size && chosen.heightHints[size] && (
                  <p className="stat-card-note">{chosen.heightHints[size]}</p>
                )}
              </div>

              <div className="stat-card">
                <p className="stat-card-label">Movement</p>
                <div className="stat-card-row">
                  <span>Speed</span>
                  <span className="stat-card-value">{chosen.speed} ft</span>
                </div>
                <p className="stat-card-note">walking</p>
              </div>

              <div className="stat-card">
                <p className="stat-card-label">Senses</p>
                <div className="stat-card-row">
                  <span>Darkvision</span>
                  <span className="stat-card-value">
                    {chosen.darkvisionFt ? `${chosen.darkvisionFt} ft` : '\u2014'}
                  </span>
                </div>
                <p className="stat-card-note">
                  {chosen.darkvisionFt ? 'see in dim light as bright' : 'no darkvision'}
                </p>
              </div>
            </div>

            <div className="trait-card">
              <p className="detail-eyebrow">Traits</p>
              <dl className="trait-list">
                {chosen.traits.map((trait) => (
                  <div className="trait-row" key={trait.name}>
                    <dt className="trait-term">{trait.name}</dt>
                    <dd className="trait-desc">
                      <Markdown source={trait.desc} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

export function ClassStep({ character, onChange }: StepProps) {
  const chosen = getClass(character.classId)
  const needStyle = chosen?.fightingStyleAt === 1
  const [pending, setPending] = useState<{ classId: string | null} | null>(null)

  function choose(classId: string | null) {
    if (classId === character.classId) return
    const next = setClass(character, classId)
    if (purseCp(next) < 0) return setPending({ classId })
    onChange(next)
  }

  return (
    <div className="step">
      <p className="step-intro">
        Pick a class. Casters are tagged; choosing a non-caster removes the Spells step.
      </p>

      <fieldset className="pick-set">
        <legend>Class &mdash; {chosen ? 1 : 0} of {catalog.classes.length}</legend>
        <div className="pick-grid is-six" role="radiogroup" aria-label="Class">
          {catalog.classes.map((cls) => {
            const picked = character.classId === cls.id

            return (
              <button
                type="button"
                role="radio"
                aria-checked={picked}
                className={`pick-tile${picked ? ' is-chosen' : ''}`}
                key={cls.id}
                onClick={() => choose(cls.id)}
              >
                <span className="pick-tile-name">
                  {cls.name}
                  {picked && (
                    <span className="pick-check" aria-hidden="true">
                      <FiCheck size={14} />
                    </span>
                  )}
                </span>
                <span className="pick-tile-meta">
                  d{cls.hitDie} · {cls.savingThrows.join('/')}
                </span>
                {cls.casterType !== 'NONE' && <span className="pick-tag">Caster</span>}
              </button>
            )
          })}
        </div>
      </fieldset>

      {chosen && (
        <section className="detail-panel" aria-labelledby="selected-class">
          <div className="detail-head">
            <div>
              <p className="detail-eyebrow">Selected class</p>
              <h3 className="detail-title" id="selected-class">{chosen.name}</h3>
            </div>
            <button type="button" className="btn btn-quiet" onClick={() => choose(null)}>
              Clear
            </button>
          </div>

          <div className="detail-body">
            <div className="stat-column">
              <div className="stat-grid">
                <div className="stat-card">
                  <p className="stat-card-label">Hit die</p>
                  <div className="stat-card-row">
                    <span>Hit die</span>
                    <span className="stat-card-value">d{chosen.hitDie}</span>
                  </div>
                  <p className="stat-card-note">level 1 HP = {chosen.hitDie} + CON</p>
                </div>

                <div className="stat-card">
                  <p className="stat-card-label">Primary</p>
                  <div className="stat-card-row">
                    <span>Primary ability</span>
                    <span className="stat-card-value is-text">
                      {chosen.primaryAbilityText || '\u2014'}
                    </span>
                  </div>
                </div>

                <div className="stat-card">
                  <p className="stat-card-label">Saves</p>
                  <div className="stat-card-row">
                    <span>Saving throws</span>
                    <span className="stat-card-value is-text">
                      {chosen.savingThrows.join(', ')}
                    </span>
                  </div>
                  <p className="stat-card-note">add proficiency</p>
                </div>

                <div className="stat-card">
                  <p className="stat-card-label">Magic</p>
                  <div className="stat-card-row">
                    <span>Spellcasting</span>
                    <span className="stat-card-value is-text">
                      {chosen.casterType === 'NONE' ? 'None' : chosen.casterType}
                    </span>
                  </div>
                  <p className="stat-card-note">
                    {chosen.casterType === 'NONE' ? 'Spells step skipped' : `${chosen.spellCounts.cantrips} cantrips, ${chosen.spellCounts.prepared} prepared`}
                  </p>
                </div>
              </div>

              {needStyle && (
                <div className="choice-card">
                  <label className="choice-label" htmlFor="fighting-style">
                    Choose &mdash; Fighting Style
                  </label>
                  <select
                    id="fighting-style"
                    className="choice-select"
                    value={character.fightingStyleId ?? ''}
                    onChange={(e) => onChange(setFightingStyle(character, e.target.value || null))}
                  >
                    <option value="">Choose a style</option>
                    {FIGHTING_STYLES.map((st) => (
                      <option value={st.id} key={st.id}>{st.name}</option>
                    ))}
                  </select>
                  <p className="choice-note">
                    {FIGHTING_STYLES.find((s) => s.id === character.fightingStyleId)?.note ?? 'Defense is recommended.'}
                  </p>
                </div>
              )}

              {chosen.startingEquipment.length > 0 && (
                <div className="trait-card">
                  <p className="detail-eyebrow">Starting equipment</p>
                  {chosen.startingEquipment.map((opt) => (
                    <div className="kit-row" key={opt.key}>
                      <span className="kit-key">{opt.key}</span>
                      <span className="kit-label">{opt.label}</span>
                    </div>
                  ))}
                  <p className="choice-note">Picked on the Equipment step.</p>
                </div>
              )}
            </div>

            <div className="stat-column">
              <div className="trait-card">
                <p className="detail-eyebrow">Level 1 features</p>
                <dl className="trait-list">
                  {chosen.features.map((ft) => (
                    <div className="trait-row" key={ft.name}>
                      <dt className="trait-term">{ft.name}</dt>
                      <dd className="trait-desc">
                        <Markdown source={ft.desc} />
                      </dd>
                    </div>
                  ))}

                  <div className="trait-row">
                    <dt className="trait-term">Proficiencies</dt>
                    <dd className="trait-desc">
                      <ul className="prof-list">
                        {chosen.proficiencies.armor && <li>Armor: {chosen.proficiencies.armor}</li>}
                        {chosen.proficiencies.weapons && <li>Weapons: {chosen.proficiencies.weapons}</li>}
                        {chosen.proficiencies.skills && <li>Skills: {chosen.proficiencies.skills}</li>}
                      </ul>
                    </dd>
                  </div>
                </dl>
              </div>

            </div>
          </div>
          <div className="detail-foot">
            <span className="detail-eyebrow">Used later</span>

            <span className="foot-chip">
              <FiArrowRight size={14} aria-hidden="true" />
              <span className="foot-chip-tag">Attributes</span>
              HP d{chosen.hitDie}, {chosen.savingThrows.join('/')} saves
            </span>

            <span className="foot-chip">
              <FiArrowRight size={14} aria-hidden="true" />
              <span className="foot-chip-tag">Skills</span>
              pick {chosen.skillChoices.count}
              {chosen.skillChoices.from !== 'any' && ` of ${chosen.skillChoices.from.length}`}
            </span>

            <span className="foot-chip">
              <FiArrowRight size={14} aria-hidden="true" />
              <span className="foot-chip-tag">Spells</span>
              {chosen.casterType === 'NONE'
                ? 'skipped'
                : `${chosen.spellCounts.cantrips} cantrips, ${chosen.spellCounts.prepared} prepared`}
            </span>

            {chosen.startingEquipment.length >0 && (
              <span className="foot-chip">
                <FiArrowRight size={14} aria-hidden="true" />
                <span className="foot-chip-tag">Equipment</span>
                kit {chosen.startingEquipment.map((o) => o.key).join(', ')}
              </span>
            )}
          </div>
        </section>
      )}

      {pending !== null && (
        <ConfirmDelete
          title="This class grants less starting gold"
          body={`You have spent ${formatCoins(spentCp(character))} at the market. Chaging class clears its equipment choice, which would leave you overdrawn until you pick a new one.`}
          confirmLabel="Change and reset market"
          busyLabel="Changing\u2026"
          secondary={{
            label: 'Change and keep purchases',
            onClick: () => onChange(setClass(character, pending.classId)),
          }}
          onConfirm={() => onChange(resetMarket(setClass(character, pending.classId)))}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  )
}

export function BackgroundStep({ character, onChange }: StepProps) {
  return (
    <div className="option-list" role="radiogroup" aria-label="Background">
      {catalog.backgrounds.map((background) => (
        <button
          type="button"
          role="radio"
          aria-checked={character.backgroundId === background.id}
          className={`option${character.backgroundId === background.id ? ' is-chosen' : ''}`}
          key={background.id}
          onClick={() => onChange(setBackground(character, background.id))}
        >
          <span className="option-name">{background.name}</span>
          <span className="option-meta">{background.abilityOptions.join(' · ')}</span>
          <span className="option-meta">
            Grants {background.skillIds.map((id) => getSkill(id)?.name).join(' and ')}
          </span>
        </button>
      ))}
    </div>
  )
}

const METHODS : { id: AbilityMethod; label: string; hint: string }[] = [
  { id: 'standard', label: 'Standard array', hint: '15 14 13 12 10 8' },
  { id: 'pointbuy', label: 'Point buy', hint: `${POINT_BUY_BUDGET} points` },
  { id: 'roll', label: 'Roll', hint: '4d6 drop lowest' },
]

function remainingPool(
  pool: readonly number[],
  character: Character,
  exclude: Ability,
): number[] {
  const left = [...pool]
  for (const ability of ABILITIES) {
    if (ability === exclude) continue
    const taken = character.abilities.base[ability]
    if (taken === undefined) continue
    const index = left.indexOf(taken)
    if (index !== -1) left.splice(index, 1)
  }
  return left
}

function withBonus(
  bonuses: Partial<AbilityScores>,
  ability: Ability,
  amount: number,
): Partial<AbilityScores> {
  const next = { ...bonuses }
  if (amount <= 0) delete next[ability]
  else next[ability] = amount
  return next
}

function DerivedCard({ source, label, value, note, signed }: {
  source: string
  label: string
  value: number | string | undefined
  note?: string
  signed?: boolean
}) {
  const shown =
    value === undefined
      ? '\u2014'
      : signed && typeof value ==='number'
        ? formatModifier(value)
        : value

  return (
    <div className="derived-card">
      <p className="derived-source">{source}</p>
      <div className="derived-row">
        <span className="derived-label">{label}</span>
        <span className="derived-value">{shown}</span>
      </div>
      {note && <p className="derived-note">{note}</p>}
    </div>
  )
}

export function AttributeStep({ character, onChange }: StepProps) {
  const { method, base, rolled, originBonuses } = character.abilities
  const background = getBg(character.backgroundId)
  const pool = method === 'standard' ? STD_ARR : rolled
  const spent = pointBuySpent(base)
  const rows = abilityRows(character)
  const d = derived(character)
  const originSpent = ABILITIES.reduce((sum, a) => sum + (originBonuses[a] ?? 0), 0)

  return (
    <div className="step step-split">
      <div className="step-main">
        <div className="method-row">
          {METHODS.map((m) => (
            <button
              type="button"
              className={`method${method === m.id ? ' is-chosen' : ''}`}
              key={m.id}
              onClick={() => onChange(setAbilityMethod(character, m.id))}
            >
              <span className="option-name">{m.label}</span>
              <span className="option-meta">{m.hint}</span>
            </button>
          ))}
        </div>
        
        {method === 'roll' && (
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => onChange(setRolledPool(character, rollAbilityPool()))}
          >
            {rolled.length ? 'Roll again' : 'Roll six scores'}
          </button>
        )}

        {method === 'pointbuy' && (
          <p className={`budget${spent > POINT_BUY_BUDGET ? ' is-over' : ''}`}>
            {spent === Infinity ? 'Invalid spread' : `${spent} / ${POINT_BUY_BUDGET} points spent`}
          </p>
        )}

        {method && (method !== 'roll' || rolled.length > 0) && (
          <table className="ability-table">
            <thead>
              <tr>
                <th scope="col">Ability</th>
                <th scope="col">Assigned</th>
                <th scope="col" className="is-origin">{background?.name ?? 'Origin'}</th>
                <th scope="col">Total</th>
                <th scope="col">Mod</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ ability, assigned, origin, total, modifier }) => (
                <tr key={ability}>
                  <th scope="row">{ability}</th>
                  <td>
                    {method === 'pointbuy' ? (
                      <span className="stepper">
                        <button type="button" aria-label={`Decrease ${ability}`}
                          disabled={(assigned ?? POINT_BUY_MIN) <= POINT_BUY_MIN}
                          onClick={() => onChange(setAbilityScore(character, ability, (assigned ?? POINT_BUY_MIN) -1))}>
                          &minus;
                        </button>
                        <span className="stepper-value">{assigned ?? POINT_BUY_MIN}</span>
                        <button type="button" aria-label={`Increase ${ability}`}
                          disabled={(assigned ?? POINT_BUY_MIN) >= POINT_BUY_MAX}
                          onClick={() => onChange(setAbilityScore(character, ability, (assigned ?? POINT_BUY_MIN) +1))}>
                          +
                        </button>
                      </span>
                    ) : (
                      <select aria-label={`${ability} score`} value={assigned ?? ''}
                        onChange={(e) => onChange(setAbilityScore(character, ability,
                          e.target.value === '' ? undefined : Number(e.target.value)))}>
                        <option value="">-</option>
                        {[...new Set(remainingPool(pool, character, ability))]
                          .sort((a, b) => b - a)
                          .map((value) => <option value={value} key={value}>{value}</option>)}
                          {assigned !== undefined && !pool.includes(assigned) && (
                            <option value={assigned}>{assigned}</option>
                          )}
                      </select>
                    )}
                  </td>
                  <td className="is-origin">{origin === 0 ? '\u2014' : `+${origin}`}</td>
                  <td className="is-total">{total ?? '\u2014'}</td>
                  <td className="is-mod">{modifier === undefined ? '\u2014' : formatModifier(modifier)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {background && (
          <fieldset className="origin-choice">
            <legend>{background.name}: +2 and +1, or +1 to each</legend>
            <div className="origin-row">
              {background.abilityOptions.map((ability) => {
                const amount = originBonuses[ability] ?? 0

                return (
                  <div className="origin-item" key={ability}>
                    <span className="ability-key">{ability}</span>
                    <span className="stepper">
                      <button
                        type="button"
                        aria-label={`Decrease ${ability} bonus`}
                        disabled={amount === 0}
                        onClick={() => onChange(setOriginBonuses(character, withBonus(originBonuses, ability, amount - 1)))}
                      >
                        &minus;
                      </button>
                      <span className="stepper-value">{formatModifier(amount)}</span>
                      <button
                        type="button"
                        aria-label={`Increase ${ability} bonus`}
                        disabled={amount > 2 || originSpent >= ORIGIN_TOTAL}
                        onClick={() => onChange(setOriginBonuses(character, withBonus(originBonuses, ability, amount + 1)))}
                      >
                        +
                      </button>
                    </span>
                  </div>
                )
              })}
            </div>
            <p className={`budget${originSpreadValid(originBonuses) ? '' : ' is-over'}`}>
              {originSpent} / {ORIGIN_TOTAL} assigned. Only {background.name}&rsquo;s three abilities
              can be raised; switching backgrounds clears this.
            </p>
          </fieldset>
        )}
      </div>

      <aside className="derived-panel">
        <p className="derived-title">Calculated for you</p>
        <p className="derived-intro">
          None of this is stored. It recomputes from your scores plus race, class, background, and equipment.
        </p>

        <div className="derived-grid">
          <DerivedCard source="Equipment" label="Armor class" value={d.armorClass} />
          <DerivedCard source="Class + CON" label="Hit points" value={d.hitPoints} />
          <DerivedCard source="Race" label="Speed" value={d.speed} note={d.size} />
          <DerivedCard source="Level" label="Proficieny bonus" value={d.proficiencyBonus} signed />
          <DerivedCard source="DEX" label="Initiative" value={d.intitiative} signed />
          <DerivedCard source="WIS + prof" label="Passive Perception" value={d.passivePerception} />
        </div>

        {d.savingThrows.length > 0 && (
          <div className="derived-card">
            <p className="derived-source">Class</p>
            <p className="derived-label">Saving throws</p>
            <div className="save-chips">
              {d.savingThrows.map(({ ability, modifier, proficient }) => (
                <span className={`save-chip${proficient ? ' is-proficient' : ''}`} key={ability}>
                  <span className="save-key">{ability}</span>
                  <span className="save-mod">{formatModifier(modifier)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

export function SkillsStep({ character, onChange }: StepProps) {
  const cls = getClass(character.classId)
  const background = getBg(character.backgroundId)
  if (!cls) return <p className="step-hint">Choose a class first.</p>

  const options = classSkillOptions(cls, background)
  const max = cls.skillChoices.count
  const full = character.proficientSkillIds.length >= max

  const granted = background?.skillIds ?? []
  const rows = skillRows(character)
  const d = derived(character)
  const stealthArmor = armorStealthDisadvantage(character)
  const proficientCount = rows.filter((row) => row.source !== null).length

  const wantExpertise = expertiseCounts(cls, character.level)
  const proficient = [...character.proficientSkillIds, ...granted]
  const expertiseFull = character.expertiseIds.length >= wantExpertise

  return (
    <div className="step step-split">
      <div className="step-main">
        <fieldset className="origin-choice">
          <legend>
            {cls.name} &mdash; choose {max} &mdash; {character.proficientSkillIds.length} / {max}
          </legend>
          <div className="chip-grid">
            {options.map((id) => {
              const skill = getSkill(id)
              const picked = character.proficientSkillIds.includes(id)

              return (
                <button
                  type="button"
                  className={`chip chip-wide${picked ? ' is-chosen' : ''}`}
                  key={id}
                  aria-pressed={picked}
                  disabled={!picked && full}
                  onClick={() => onChange(toggleSkill(character, id, max))}
                >
                  {skill?.name}
                  <span className="chip-meta">{skill?.ability}</span>
                </button>
              )
            })}
          </div>
          {full && <p className="step-hint">Full. Deselect one to swap.</p>}
        </fieldset>

        {granted.length > 0 && background && (
          <fieldset className="origin-choice">
            <legend>Granted &mdash; not choosable</legend>
            <div className="chip-grid">
              {granted.map((id) => (
                <span className="chip chip-wide is-locked" key={id}>
                  {getSkill(id)?.name}
                </span>
              ))}
            </div>
            <p className="step-hint">
              Already granted by {background.name}, so they are removed from {cls.name} picks above and no choice is wasted.
            </p>
          </fieldset>
        )}

        {wantExpertise > 0 && (
          <fieldset className="origin-choice">
            <legend>
              Expertise &mdash; choose {wantExpertise} &mdash;{' '}
              {character.expertiseIds.length} / {wantExpertise}
            </legend>
            <div className="chip-grid">
              {proficient.map((id) => {
                const picked = character.expertiseIds.includes(id)

                return (
                  <button
                    type="button"
                    className={`chip chip-wide${picked ? ' is-chosen' : ''}`}
                    key={id}
                    aria-pressed={picked}
                    disabled={!picked && expertiseFull}
                    onClick={() => onChange(toggleExpertise(character, id, wantExpertise))}
                  >
                    {getSkill(id)?.name}
                    <span className="chip-meta">{getSkill(id)?.ability}</span>
                  </button>
                )
              })}
            </div>
            <p className="step-hint">
              Expertise doubles the proficiency bonus, so {formatModifier(d.proficiencyBonus)}{' '}
              becomes {formatModifier(d.proficiencyBonus * 2)}. Any proficiency qualifies, including
              the ones {background?.name ?? 'your background'} grants.
            </p>
          </fieldset>
        )}

        <fieldset className="origin-choice">
          <legend>Where proficiencies come from</legend>
          <dl className="source-list">
            <dt>Race &middot; {getRace(character.raceId)?.name ?? '\u2014'}</dt>
            <dd>none</dd>
            <dt>Class &middot; {cls.name}</dt>
            <dd>{max} of {options.length} &middot; player picks</dd>
            <dt>Background &middot; {background?.name ?? '\u2014'}</dt>
            <dd>
              {granted.length >0
                ? `${granted.map((id) => getSkill(id)?.name).join(', ')} \u00b7 fixed`
                : 'none'}
            </dd>
          </dl>
          <p className="step-hint">
            Changing class or background on an earlier step clears the {cls.name} picks and re-asks.
          </p>
        </fieldset>
      </div>

      <aside className="derived-panel">
        <p className="derived-title">Calculated for you</p>
        <p className="derived-intro">
          Skill bonus = ability modifier, plus {formatModifier(d.proficiencyBonus)} proficiency if proficient. Nothing here is stored.
        </p>

        <table className="ability-table skill-table">
          <thead>
            <tr>
              <th scope="col">Skill</th>
              <th scope="col">Ability</th>
              <th scope="col">Proficient</th>
              <th scope="col">Math</th>
              <th scope="col">Bonus</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.source ? 'is-proficient' : undefined}>
                <th scope="row">{row.name}</th>
                <td>{row.ability}</td>
                <td className="is-origin">
                  {row.source ? (
                    row.source.expert ? (
                      <FiCheckCircle size={18} strokeWidth={3} role="img" aria-label={`Expertise via ${row.source.label}`} /> 
                    ) : (
                      <FiCheck size={18} strokeWidth={3} role="img" aria-label={`Proficient via ${row.source.label}`} />
                    ) 
                  ) : (
                    <span aria-hidden="true">&mdash;</span>
                  )}
                </td>
                <td className="is-math">
                  {row.math}
                  {row.stealthDisadvantage && <span className="is-warn"> &middot; disadv.</span>}
                </td>
                <td className="is-mod">{row.bonus === undefined ? '\u2014' : formatModifier(row.bonus)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="derived-grid">
          <DerivedCard
            source="Perception"
            label="Passive Perception"
            value={d.passivePerception}
            note={d.passivePerception === undefined ? undefined : `10 + ${d.passivePerception - 10}`}
          />
          {stealthArmor && (
            <DerivedCard source="Equipment" label="Stealth checks" value="Disadv." note={stealthArmor} />
          )}
        </div>

        <p className="budget">
          {proficientCount} proficient skills
          {!isStepApplicable('spells', character) && ` \u00b7 Spells skipped for ${cls.name}`}
        </p>
      </aside>
    </div>
  )
}

export function SpellsStep({ character, onChange }: StepProps) {
  const cls = getClass(character.classId)
  const bg = getBg(character.backgroundId)
  const options = spellOptions(cls, bg)

  if (options.length === 0) {
    return <p className="step-hint">This character doesn&rsquo;t cast spells.</p>
  }

  const budget = spellBudget(cls, bg)
  const chosenCantrips = character.spellIds.filter((id) => getSpell(id)?.level === 0).length
  const sd = spellDerived(character)
  const want = budget.cantrips + budget.prepared

  const groups = [
    { label: 'Cantrips', list: options.filter((s) => s.level === 0), have: chosenCantrips, want: budget.cantrips },
    { label: '1st level', list: options.filter((s) => s.level > 0), have: character.spellIds.length - chosenCantrips, want: budget.prepared },
  ]

  return (
    <div className="step step-split">
      <div className="step-main">
        <p className="step-hint">
          Choose {budget.cantrips} cantrips and {budget.prepared} 1st-level spells.
        </p>

        {groups.map(({ label, list, have, want: groupWant }) =>
          list.length === 0 || groupWant === 0 ? null : (
            <fieldset className="spell-group" key={label}>
              <legend>{label} &mdash; {have} / {groupWant}</legend>
              <div className="chip-grid">
                {list.map((spell) => {
                  const picked = character.spellIds.includes(spell.id)
                  return (
                    <button
                      type="button"
                      className={`chip chip-wide${picked ? ' is-chosen' : ''}`}
                      key={spell.id}
                      aria-pressed={picked}
                      disabled={!picked && have >= groupWant}
                      onClick={() => onChange(toggleSpell(character, spell.id))}
                    >
                      {spell.name}
                      <span className="chip-meta">{spell.school}</span>
                    </button>
                  )
                })}
              </div>
              <p className="step-hint">
                {have >= groupWant
                  ? 'Full. Deselect one to swap.'
                  : `${groupWant - have} more to choose.`}
              </p>
            </fieldset>
          ),
        )}

        <p className="budget">
          {character.spellIds.length} of {want} spells chosen
        </p>
      </div>

      <aside className="derived-panel">
        <p className="derived-title">Calculated</p>
        <div className="derived-grid is-single">
          <DerivedCard
            source={`8 + prof + ${sd.ability ?? 'ability'}`}
            label="Spell save DC"
            value={sd.saveDC}
          />
          <DerivedCard
            source={`prof + ${sd.ability ?? 'ability'}`}
            label="Spell attack"
            value={sd.attackBonus}
            signed
          />
          <DerivedCard
            source={cls?.name ?? 'Class'}
            label="Spellcasting ability"
            value={sd.abilityModifier}
            note={sd.ability}
            signed
          />
          <DerivedCard source="Class table" label="1st-level slots" value={sd.slots} />
        </div>
      </aside>
    </div>
  )
}

export function EquipmentStep({ character, onChange }: StepProps) {
  const [query, setQuery] = useState('')
  const cls = getClass(character.classId)
  const bg = getBg(character.backgroundId)
  if (!cls || !bg) return <p className="step-hint">Choose a class and background first.</p>

  const purse = purseCp(character)

  const counts = new Map<string, number>()
  for (const id of character.purchasedItemIds) {
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  const sources = [
    { source: 'class' as const, name: cls.name, options: cls.startingEquipment, picked: character.equipmentChoice.class?.key ?? null },
    { source: 'background' as const, name: bg.name, options: bg.startingEquipment, picked: character.equipmentChoice.background?.key ?? null },
  ]

  const stock = purchaseableEquipment()
  const needle = query.trim().toLowerCase()
  const shown = stock.filter((item) => item.name.toLowerCase().includes(needle))
  
  return (
    <div className="step">
      {sources.map(({ source, name, options, picked}) => 
        options.length === 0 ? null : (
          <fieldset className="origin-choice" key={source}>
            <legend>
              {name} &mdash; choose {options.map((option) => option.key).join(' or ')}
            </legend>
            <div className="equip-options">
              {options.map((option) => (
                <button
                  type="button"
                  className={`equip-option${picked === option.key ? ' is-chosen' : ''}`}
                  key={option.key}
                  aria-pressed={picked === option.key}
                  onClick={() => onChange(setEquipmentChoice(character, source, picked === option.key ? null : option.key))}
                >
                  <span className="equip-option-key">{option.key}</span>
                  <span className="equip-option-key">{option.label}</span>
                  {option.goldCp > 0 && (
                    <span className="equip-option-gold">{formatCoins(option.goldCp)}</span>
                  )}
                </button>
              ))}
            </div>
          </fieldset>
        ),
      )}

      <fieldset className="origin-choice">
        <legend>
          Market &mdash; {formatCoins(purse)} left{purse < 0 && ' \u2014 overspent'}
        </legend>

        {counts.size > 0 && (
          <div className="cart">
            {[...counts].map(([id, count]) => {
              const item = catalog.equipment.find((eq) => eq.id === id)

              return (
                <button
                  type="button"
                  className="chip cart-item"
                  key={id}
                  aria-label={`Sell back one ${item?.name}`}
                  onClick={() => onChange(sellItem(character, id))}
                >
                  {count > 1 && <span className="cart-count">{count}&times;</span>}
                  {item?.name}
                  <FiX size={13} aria-hidden="true" />
                </button>
              )
            })}
          </div>
        )}

        <div className="shop-search">
          <label htmlFor="shop-query">Search</label>
          <input
            id="shop-query"
            type="search"
            value={query}
            placeholder="rope, dagger, lantern&hellip;"
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="shop-count">
            {shown.length} of {purchaseableEquipment().length}
          </span>
        </div>

        {shown.length === 0 ? (
          <p className="step-hint">Nothing matches &ldquo;{query}&rdquo;</p>
        ) : (
          <div className="shop-grid">
            {shown.map((item) => {
              const owned = counts.get(item.id) ?? 0

              return (
                <button
                  type="button"
                  className={`shop-item${owned > 0 ? ' is-chosen' : ''}`}
                  key={item.id}
                  title={item.desc}
                  disabled={item.costCp > purse}
                  onClick={() => onChange(buyItem(character, item.id))}
                >
                  <span className="shop-name">{item.name}</span>
                  <span className="shop-cost">{formatCoins(item.costCp)}</span>
                  {owned > 0 && <span className="shop-owned">{owned}</span>}
                </button>
              )
            })}
          </div>
        )}
        <p className="step-hint">
          Click an item to buy one. Click it above to sell it back.
        </p>
      </fieldset>
    </div>
  )
}