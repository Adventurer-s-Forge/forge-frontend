import { createDraft, type Character } from "./character";
import { authed } from "../lib/api";

function toPayload(character: Character) {
  return {
    id: character.id,
    name: character.name,
    level: character.level,
    raceId: character.raceId,
    sizeChoice: character.sizeChoice,
    classId: character.classId,
    backgroundId: character.backgroundId,
    abilities: character.abilities,
    proficientSkillIds: character.proficientSkillIds,
    expertiseIds: character.expertiseIds,
    spellIds: character.spellIds,
    equipmentChoice: character.equipmentChoice,
    walletCp: character.walletCp,
    purchasedItemIds: character.purchasedItemIds,
    completedSteps: character.completedSteps,
  }
}

/** Records written before the EquipmentPick change stored only the option letter.
 * A letter alone cannot be turned back into a pick, so the step is reset and the
 * wizard asks for it again. */

function migrateEquipment(raw: Character): 
  Pick<Character, 'equipmentChoice' | 'purchasedItemIds' | 'walletCp' | 'completedSteps'> {
  const choice = (raw.equipmentChoice ?? { class: null, background: null }) as {
    class: unknown
    background: unknown
  }

  if (typeof choice.class === 'string' || typeof choice.background === 'string') {
    return {
      equipmentChoice: { class: null, background: null },
      purchasedItemIds: [],
      walletCp: 0,
      completedSteps: (raw.completedSteps ?? []).filter((step) => step != 'equipment'),
    }
  }

  const picks = {
    class: (choice.class ?? null) as Character['equipmentChoice']['class'],
    background: (choice.class ?? null) as Character['equipmentChoice']['background'],
  }

  return {
    equipmentChoice: picks,
    purchasedItemIds: raw.purchasedItemIds ?? [],
    walletCp: typeof raw.walletCp === 'number' ? raw.walletCp : (picks.class?.goldCp ?? 0) + (picks.background?.goldCp ?? 0),
    completedSteps: raw.completedSteps ?? [],
  }
}

function requireName(character: Character): void {
  if (character.name.trim() === '') {
    throw new Error('A character needs a name before it can be saved')
  }

}

export const characterStore = {
  async list(): Promise<Character[]> {
    return ((await authed.get<Character[]>('characters')) ?? []).map(fromResponse)
  },

  async create(character: Character): Promise<Character> {
    requireName(character)
    const created = await authed.post<Character>('characters', toPayload(character))
    if (!created) throw new Error('The server did not return the created character.')
    return created
  },

  async update(character: Character): Promise<Character> {
    requireName(character)
    const updated = await authed.put<Character>(
      `characters/${character.id}`,
      toPayload(character)
    )
    if (!updated) throw new Error('The server did not return the updated character.')
    return updated
  },

  async remove(id: string): Promise<void> {
    await authed.del(`characters/${id}`)
  },
}

function fromResponse(raw: Character): Character {
  return {
    ...createDraft(),
    ...raw,
    abilities: { ...createDraft().abilities, ...raw.abilities },
    ...migrateEquipment(raw),
    expertiseIds: raw.expertiseIds ?? [],
  }
}