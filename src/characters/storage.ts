import type { Character } from "./character";

const keyFor = (uid: string) => `forge:characters:${uid}`

function read(uid: string): Character[] {
  const raw = localStorage.getItem(keyFor(uid))
  return raw ? (JSON.parse(raw) as Character[]) : []
}

export const characterStore = {
  async list(uid: string): Promise<Character[]> {
    return read(uid)
  },

  async save(uid: string, character: Character): Promise<Character> {
    if (character.name.trim() === '') {
      throw new Error('A character needs a name before it can be saved.')
    }
    const saved = { ...character, updatedAt: new Date().toISOString() }
    const characters = read(uid)
    const index = characters.findIndex((existing) => existing.id === saved.id)
    if  (index === -1) characters.push(saved)
    else characters[index] = saved
    localStorage.setItem(keyFor(uid), JSON.stringify(characters))
    return saved
  },
}