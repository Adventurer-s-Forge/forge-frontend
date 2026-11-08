export type HpState = {
  max: number
  current: number
  temp: number
  hitDiceLeft: number
}

export type HpEntry = { label: string; before: HpState; after: HpState }

export type HpSession = { state: HpState; log: HpEntry[] }

const whole = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0)

export const fullHp = (max: number, hitDice: number): HpState => ({
  max,
  current: max,
  temp: 0,
  hitDiceLeft: hitDice,
})

/** Temporary hit points soak damage first; real hit points stop at 0. */
export function takeDmg(state: HpState, amount: number): HpState {
  const hit = whole(amount)
  const soaked = Math.min(state.temp, hit)
  return { ...state, temp: state.temp - soaked, current: Math.max(0, state.current - (hit - soaked)) }
}

/** Healing never passes the maximum and never touches the temporary hit points. */
export function heal(state: HpState, amount: number): HpState {
  return { ... state, current: Math.min(state.max, state.current + whole(amount)) }
}

/** Temporary hit points do not stack, so the stepper sets the pool directly */
export const setTemp = (state: HpState, temp: number): HpState => ({ ...state, temp: whole(temp) })

/** Short rest: one die plus CON, never less than 1 hit point back. */
export function spendHitdie(state: HpState, roll: number, conMod: number): HpState {
  if (state.hitDiceLeft === 0) return state
  return { ...heal(state, Math.max(1, roll + conMod)), hitDiceLeft: state.hitDiceLeft - 1 }
}

export const rollDie = (sides: number, rng: () => number = Math.random) => Math.floor(rng() * sides) + 1

export const startSession = (max: number, hitDice: number): HpSession => ({
  state: fullHp(max, hitDice),
  log: [],
})

const sameHp = (a: HpState, b: HpState) => a.current === b.current && a.temp === b.temp && a.hitDiceLeft === b.hitDiceLeft

/** A step that changes nothing is not logged, so Undo never undoes a no-op. Newest first */
export function record(session: HpSession, label: string, next: HpState): HpSession {
  if (sameHp(session.state, next)) return session
  return { state: next, log: [{ label, before: session.state, after: next }, ...session.log] }
}

export function undo(session: HpSession): HpSession {
  const [last, ...rest] = session.log
  return last ? { state: last.before, log: rest } : session
}