/** Costs arive as GP strings with two decimals, which is exactly copper precision,
 * so all money is integer copper and never a float. */

export const CP_PER = { CP: 1, SP: 10, EP: 50, GP: 100, PP: 1000 } as const
export type Coin = keyof typeof CP_PER

export const gpToCp = (gp: number) => Math.round(gp * CP_PER.GP)

export function parseCostCp(cost: string | null | undefined): number {
  const gp = Number(cost)
  return Number.isFinite(gp) ? gpToCp(gp) : 0
}

export function formatCoins(cp: number): string {
  if (cp === 0) return '0 GP'
  const sign = cp < 0 ? '\u2212' : ''
  let left = Math.abs(cp)
  const parts: string[] = []

  for (const coin of ['GP', 'SP', 'CP'] as const) {
    const n = Math.floor(left / CP_PER[coin])
    if (n > 0) {
      parts.push(`${n} ${coin}`)
      left -= n * CP_PER[coin]
    }
  }
  return sign + parts.join(' ')
}