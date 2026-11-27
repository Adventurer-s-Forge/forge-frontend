import { FiChevronDown } from "react-icons/fi";
import type { Ability, AbilityScores, Character } from "../../characters/character";
import { ABILITIES, POINT_BUY_BUDGET, POINT_BUY_COST, POINT_BUY_MIN, abilityModifier, formatModifier } from "../../characters/abilities";
import { cheaperScore, classWeights, recommend } from "../../characters/optimizer";
import { getBg, getClass, type CharacterClass } from "../../data/catalog";
import "./PointBuyAdvice.css"

/** " + 1" when the ability has a bonus, nothing when it has none, so "CON 14 + 1" and "INT 13" read alike. */
const plus = (bonus: number) => (bonus ? ` + ${bonus}` : '')

/** This is used so the recommended scores can be returned to steps.tsx when the user clicks the button to automatically assign the recommended ability scores. */
let recommendedScoresForAutoAssign: AbilityScores | null

/** Why the recommendation buys this score: how much the class cares about it, then what its bonus does. */
function reason(cls: CharacterClass, ability: Ability, score: number, bonus: number): string {
  const role = cls.primaryAbilities.includes(ability)
    ? `Primary ability for a ${cls.name}.`
    : cls.savingThrows.includes(ability)
      ? `${cls.name} saving throw.`
      : ability === 'CON'
        ? 'Constitution adds hit points for every class.'
        : `Lower priority for a ${cls.name}.`

  const effect =
    bonus === 2 ? 'Takes the +2.'
    : bonus === 1 && score % 2 === 1 ? `Odd on purpose: the +1 brings it to ${score + 1}.`
    : bonus === 1 ? 'Takes the +1.'
    : score === POINT_BUY_MIN ? 'Left at 8 so the points go further elsewhere.'
    : ''

  return effect ? `${role} ${effect}` : role
}

/**
 * US-42: Returns the recommended ability scores so they can be automatically assigned when the pertinent button is clicked.
 * @returns The recommended ability scores to use in the auto assign logic
 */
export function getRecommendedScoresForAutoAssign(): AbilityScores | null {
  return recommendedScoresForAutoAssign
}

/**
 * US-41: flags point-buy scores that waste points, and shows the best spread for the class and background.
 * A native <details>, so it folds without any state, and starts open so the flags are seen. Text only --
 * it reads the character and never changes it.
 */
export function PointBuyAdvice({ character }: { character: Character }) {
  const cls = getClass(character.classId)
  const background = getBg(character.backgroundId)
  if (!cls || !background) return null

  const { base, originBonuses } = character.abilities
  const wasted = ABILITIES.flatMap((ability) => {
    const score = base[ability] ?? POINT_BUY_MIN
    const bonus = originBonuses[ability] ?? 0
    const cheaper = cheaperScore(score, bonus)
    return cheaper === null ? [] : [{ ability, score, bonus, cheaper }]
  })
  const rec = recommend(classWeights(cls), background.abilityOptions)

  /** Set the variable that is scoped to the entire file so the recommended ability scores can be automatically set when the user clicks the pertinent button */
  recommendedScoresForAutoAssign = rec ? rec.base : null

  const count =
    wasted.length === 0
      ? 'No wasted points'
      : `${wasted.length} ${wasted.length === 1 ? 'score wastes' : 'scores waste'} points`

  return (
    <details className="pb-advice" aria-labelledby="pb-advice-title" open>
      <summary className="pb-summary">
        <span className="pb-advice-title" id="pb-advice-title">Point-buy advice</span>
        <span className={`pb-count${wasted.length > 0 ? ' is-wasted' : ''}`}>{count}</span>
        <FiChevronDown className="pb-chevron" size={16} aria-hidden="true" />
      </summary>

      <div className="pb-body">
        {wasted.length > 0 && (
          <ul className="pb-wasted" aria-label="Wasted points">
            {wasted.map(({ ability, score, bonus, cheaper }) => {
              const saved = POINT_BUY_COST[score] - POINT_BUY_COST[cheaper]
              return (
                <li key={ability}>
                  <strong>{ability} {score}{plus(bonus)}</strong> gives {formatModifier(abilityModifier(score + bonus))},
                  the same as {cheaper}{plus(bonus)}, which costs {saved} {saved === 1 ? 'point' : 'points'} less.
                </li>
              )
            })}
          </ul>
        )}

        {rec && (
          <>
            <p className="step-hint">
              Recommended for a {cls.name} with the {background.name} background, using {rec.spent} of {POINT_BUY_BUDGET} points.
              A suggestion only: nothing here changes your scores.
            </p>
            <table className="ability-table pb-table" aria-label="Recommended scores">
              <thead>
                <tr>
                  <th scope="col">Ability</th>
                  <th scope="col">Score</th>
                  <th scope="col" className="is-origin">{background.name}</th>
                  <th scope="col">Total</th>
                  <th scope="col">Mod</th>
                  <th scope="col">Why</th>
                </tr>
              </thead>
              <tbody>
                {ABILITIES.map((ability) => {
                  const score = rec.base[ability]
                  const bonus = rec.bonuses[ability] ?? 0
                  return (
                    <tr key={ability}>
                      <th scope="row">{ability}</th>
                      <td>{score}</td>
                      <td className="is-origin">{bonus ? `+${bonus}` : '\u2014'}</td>
                      <td className="is-total">{score + bonus}</td>
                      <td className="is-mod">{formatModifier(abilityModifier(score + bonus))}</td>
                      <td className="pb-why">{reason(cls, ability, score, bonus)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="step-hint">Weighted for the class: primary ability 3, saving throws and Constitution 2, the rest 1.</p>
          </>
        )}
      </div>
    </details>
  )
}
