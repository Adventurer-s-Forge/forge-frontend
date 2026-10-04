import { useEffect, useState } from "react";
import type { Character } from "./character";
import { characterStore } from "./storage";

export function useCharacters(uid: string) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let canx = false
    characterStore
      .list()
      .then((list) => {
        if (!canx) setCharacters(list)
      })
      .catch((err) => {
        if (!canx) {
          setError(err instanceof Error ? err.message : "Couldn't load your characters.")
        }
      })
      .finally(() => {
        if (!canx) setLoading(false)
      })
    return () =>{
      canx = true
    }
  }, [uid])

  async function save(character:Character): Promise<Character> {
    const known = characters.some((existing) => existing.id === character.id)
    const saved= known
      ? await characterStore.update(character)
      : await characterStore.create(character)

    setCharacters((current) =>
      current.some((c) => c.id === saved.id)
        ? current.map((c) => (c.id === saved.id ? saved : c))
        : [...current, saved],
    )

    return saved
  }

  async function remove(id: string): Promise<void> {
    await characterStore.remove(id)
    setCharacters((current) => current.filter((character) => character.id !== id))
  }

  return { characters, loading, error, save, remove }
}