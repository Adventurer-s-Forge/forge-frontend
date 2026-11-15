import type { Skill } from "./catalog";

/** Backgrounds describe their proficiencies as prose ("Insight and Religion"), so the names have
 * to be matched to ids. The list is a parameter rather than read off the catalog because this
 * runs while the catalog is still being build, before `seedCatalog` is called. */
export function skillIdsFromNames(csv: string, skills: readonly Skill[]): string[] {
  const byName = new Map(skills.map((skill) => [skill.name.toLowerCase(), skill.id]))

  return csv
    .split(/,|\s+and\s+/)
    .map((pt) => byName.get(pt.trim().toLowerCase()))
    .filter((id): id is string => id !== undefined)
}