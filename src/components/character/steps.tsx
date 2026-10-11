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
  setAbilityMethod,
  setAbilityScore,
  setBackground,
  setClass,
  setName,
  setOriginBonuses,
  setRace,
  setRolledPool,
  setSizeChoice,
  toggleEquipment,
  toggleSkill,
  toggleSpell,
} from "../../characters/progress";
import {
  catalog,
  classSkillOptions,
  getBg,
  getClass,
  getRace,
  getSkill,
  getSpell,
  spellBudget,
  spellOptions,
} from "../../data/catalog";
import { abilityRows, derived, spellDerived } from "./sheets";

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

  return (
    <div className="step">
      <div className="option-list" role="radiogroup" aria-label="Race">
        {catalog.races.map((race) => (
          <button
            type="button"
            role="radio"
            aria-checked={character.raceId === race.id}
            className={`option${character.raceId === race.id ? ' is-chosen' : ''}`}
            key={race.id}
            onClick={() => onChange(setRace(character, race.id))}
          >
            <span className="option-name">{race.name}</span>
            <span className="option-meta">Size: {race.sizes.join(' or ')}</span>
            <span className="option-meta">Speed: {race.speed} ft</span>
          </button>
        ))}
      </div>

      {chosen && chosen.sizes.length > 1 && (
        <fieldset className="origin-choice">
          <legend>{chosen.name}</legend>
          <div className="chip-row">
            {chosen.sizes.map((size) => {
              const picked = (character.sizeChoice ?? chosen.sizes[0]) === size

              return (
                <button
                  type="button"
                  className={`chip${picked ? ' is-chosen' : ''}`}
                  key={size}
                  aria-pressed={picked}
                  onClick={() => onChange(setSizeChoice(character, size))}
                >
                  {size}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}
    </div>
  )
}

export function ClassStep({ character, onChange }: StepProps) {
  return (
    <div className="option-list" role="radiogroup" aria-label="Class">
      {catalog.classes.map((cls) => (
        <button
          type="button"
          role="radio"
          aria-checked={character.classId === cls.id}
          className={`option${character.classId === cls.id ? ' is-chosen' : ''}`}
          key={cls.id}
          onClick={() => onChange(setClass(character, cls.id))}
        >
          <span className="option-name">{cls.name}</span>
          <span className="option-meta">Dice: d{cls.hitDie} hit die</span>
          <span className="option-meta">Saves: {cls.savingThrows.join(', ')}</span>
          <span className="option-meta">Skills: {cls.skillChoices.count}</span>
        </button>
      ))}
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

  return (
    <div className="step">
      <p className="step-hint">
        Choose {max} from {cls.name}.{' '}
        {background &&
          `${background.name} already grants ${background.skillIds.map((id) => getSkill(id)?.name).join(' and ')}.`}
      </p>

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

      <p className="budget">
        {character.proficientSkillIds.length} / {max} chosen
      </p>
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

const CAT_LABELS = { weapon: 'Weapons', armor: 'Armor', gear: 'Gear' } as const

export function EquipmentStep({ character, onChange }: StepProps) {
  return (
    <div className="step">
      <p className="step-hint">Optional - pick anything your character carries.</p>

      {(['weapon', 'armor', 'gear'] as const).map((category) => (
        <section className="equip-group" key={category}>
          <h3>{CAT_LABELS[category]}</h3>
          <div className="chip-grid">
            {catalog.equipment.filter((eq) => eq.category === category).map((eq) => {
              const picked = character.equipmentIds.includes(eq.id)

              return (
                <button
                  type="button"
                  className={`chip chip-wide${picked ? ' is-chosen' : ''}`}
                  key={eq.id}
                  aria-pressed={picked}
                  title={eq.desc}
                  onClick={() => onChange(toggleEquipment(character, eq.id))}
                >
                  {eq.name}
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}