import type { Ability, AbilityMethod, Character } from "../../characters/character";
import { 
  ABILITIES,
  POINT_BUY_BUDGET,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  STD_ARR,
  abilityModifier,
  finalScores,
  formatModifier,
  pointBuySpent,
  rollAbilityPool,
} from "../../characters/abilities";
import {
  setAbilityMethod,
  setAbilityScore,
  setBackground,
  setClass,
  setName,
  setRace,
  setRacialChoices,
  setRolledPool,
  toggleEquipment,
  toggleSkill,
} from "../../characters/progress";
import {
  catalog,
  classSkillOptions,
  getBg,
  getClass,
  getRace,
  getSkill,
} from "../../data/catalog";

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
  return (
    <div className="option-list" role="radiogroup" aria-label="Race">
      {catalog.races.map((race) => {
        const bonuses = Object.entries(race.abilityBonuses)
          .map(([ability, amount]) => `${ability} +${amount}`)
          .join(' . ')

          return (
            <button
              type="button"
              role="radio"
              aria-checked={character.raceId === race.id}
              className={`option${character.raceId === race.id ? ' is-chosen' : ''}`}
              key={race.id}
              onClick={() => onChange(setRace(character, race.id))}
            >
              <span className="option-name">{race.name}</span>
              <span className="option-meta">
                {bonuses || 'No fixed bonuses'}
                {race.abilityChoice &&
                ` · +${race.abilityChoice.amount} to ${race.abilityChoice.count} of your choice`}
              </span>
              <span className="option-meta">
                {race.size} · { race.speed} ft
              </span>
            </button>
          )
      })}
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
          <span className="option-meta">
            d{cls.hitDie} hit die · saves {cls.savingThrows.join(', ')}
          </span>
          <span className="option-meta">{cls.skillChoices.count} skills</span>
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

export function AttributeStep({ character, onChange }: StepProps) {
  const { method, base, rolled, racialChoices } = character.abilities
  const race = getRace(character.raceId)
  const choice = race?.abilityChoice
  const pool = method === 'standard' ? STD_ARR : rolled
  const spent = pointBuySpent(base)
  const totals = finalScores(base, race, racialChoices)

  return (
    <div className="step">
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
        <ul className="ability-rows">
          {ABILITIES.map((ability) => {
            const score = base[ability]
            const total = totals[ability]

            return (
              <li className="ability-row" key={ability}>
                <span className="ability-key">{ability}</span>

                {method === 'pointbuy' ? (
                  <span className="stepper">
                    <button
                      type="button"
                      aria-label={`Decrease ${ability}`}
                      disabled={(score ?? POINT_BUY_MIN) <= POINT_BUY_MIN}
                      onClick={() => onChange(setAbilityScore(character, ability, (score ?? POINT_BUY_MIN) -1))}
                    >
                      &minus;
                    </button>
                    <span className="stepper-value">{score ?? POINT_BUY_MIN}</span>
                    <button
                      type="button"
                      aria-label={`Increase ${ability}`}
                      disabled={(score ?? POINT_BUY_MIN) >= POINT_BUY_MAX}
                      onClick={() => onChange(setAbilityScore(character, ability, (score ?? POINT_BUY_MIN) + 1 ))}
                    >
                      +
                    </button>
                  </span>
                ) : (
                  <select
                    aria-label={`${ability} score`}
                    value={score ?? ''}
                    onChange={(e) => onChange(setAbilityScore(character, ability, e.target.value === '' ? undefined : Number(e.target.value)))}
                  >
                    <option value="">-</option>
                    {[...new Set(remainingPool(pool, character, ability))]
                      .sort((a, b) => b - a)
                      .map((value) => (
                        <option value={value} key={value}>
                          {value}
                        </option>
                      ))}
                    {score !== undefined && !pool.includes(score) && (
                      <option value={score}>{score}</option>
                    )}
                  </select>
                )}

                <span className="ability-total">
                  {total === undefined ? '-' : total}
                  <span className="ability-mod">
                    {total === undefined ? '' : formatModifier(abilityModifier(total))}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {choice && (
        <fieldset className="racial-choice">
          <legend>
            {race?.name}: +{choice.amount} to {choice.count}{' '}
            {choice.count === 1 ? 'ability' : 'abilities'}
          </legend>
          <div className="chip-row">
            {ABILITIES.filter((ability) => !choice.exclude.includes(ability)).map(
              (ability) => {
                const picked = racialChoices.includes(ability)
                const full = racialChoices.length >= choice.count

                return (
                  <button
                    type="button"
                    className={`chip${picked ? ' is-chosen' : ''}`}
                    key={ability}
                    aria-pressed={picked}
                    disabled={!picked && full}
                    onClick={() => onChange(setRacialChoices(character, picked ? racialChoices.filter((a) => a !== ability) : [...racialChoices, ability]))}
                  >
                    {ability}
                  </button>
                )
              },
            )}
          </div>
        </fieldset>
      )}
    </div>
  )
}

export function SkillsStep({ character, onChange }: StepProps) {
  const cls = getClass(character.classId)
  const background = getBg(character.backgroundId)
  if (!cls) return <p className="step-hint">Choose a class first.</p>

  const options = classSkillOptions(cls, background)
  const max = cls.skillChoices.count
  const full = character.skillIds.length >= max
  
  return (
    <div className="step">
      <p className="step-hint">
        Choose {max} from {cls.name}.{' '}
        {background && `${background.name} akready grants ${background.skillIds.map((id) => getSkill(id)?.name).join(' and ')}.`}
      </p>

      <div className="chip-grid">
        {options.map((id) => {
          const skill = getSkill(id)
          const picked = character.skillIds.includes(id)

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
        {character.skillIds.length} / {max} chosen
      </p>
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
            {catalog.equipment.filter((item) => item.category === category).map((item) => {
              const picked = character.equipmentIds.includes(item.id)

              return (
                <button
                  type="button"
                  className={`chip chip-wide${picked ? ' is-chosen' : ''}`}
                  key={item.id}
                  aria-pressed={picked}
                  title={item.summary}
                  onClick={() => onChange(toggleEquipment(character, item.id))}
                >
                  {item.name}
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}