import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { authErrorMessage } from "../auth/errors";
import { useAuth } from "../auth/useAuth";
import { Wordmark } from "../components/Wordmark";
import { ThemeToggle } from "../components/Themetoggle";
import { CharacterModal } from "../components/character/CharacterModal";
import { useCharacters } from "../characters/useCharacters";
import type { Character } from "../characters/character";
import { STEPS } from "../characters/character";
import { firstIncompleteStep, isComplete, duplicateCharacter } from "../characters/progress";
import { getBg, getClass, getRace } from "../data/catalog";
import { FiCopy, FiEdit2, FiTrash2 } from "react-icons/fi";
import { ConfirmDelete } from "../components/ConfirmDelete";

export function Dashboard() {
  const { user } = useAuth()
  const { characters, loading, save, remove } = useCharacters(user!.uid)
  const [editing, setEditing] = useState<null | 'new' | Character>(null)
  const [deleting, setDeleting] = useState<Character | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [duplicating, setDuplicating] = useState<string | null>(null)

  async function handleDuplicate(character: Character) {
    setError(null)
    setDuplicating(character.id)

    try {
      await save(duplicateCharacter(character))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't duplicate that character.")
    } finally {
      setDuplicating(null)
    }
  }

  async function handleSignOut() {
    setError(null)
    setSigningOut(true)

    try {
      await signOut(auth)
    } catch (err) {
      setError(authErrorMessage(err))
      setSigningOut(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="app-bar">
        <Wordmark />
        <div className="app-bar-right">
          <ThemeToggle />
          <span className="app-bar-user">{user?.displayName ?? user?.email}</span>
          <button type="button" className="btn btn-quiet" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? 'Signing out..' : 'Sign out'}
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="app-head">
          <h1>Your characters</h1>
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            New character
          </button>
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="muted">Loading your characters...</p>
        ) : characters.length === 0 ? (
          <div className="empty">
            <p className="empty-title">No characters yet</p>
            <p className="empty-body">
              Start with a race and class and the Forge will walk you through the rest - abilities, background, proficiency and equipment.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
              Forge your first character
            </button>
          </div>
        ) : (
          <ul className="character-grid">
            {characters.map((character) => {
              const done = isComplete(character)
              const next = STEPS.find((s) => s.id === firstIncompleteStep(character))
              const summary = [
                getRace(character.raceId)?.name,
                getClass(character.classId)?.name,
                getBg(character.backgroundId)?.name,
              ]
                .filter(Boolean)
                .join(' · ')

              return (
                <li className="character-card" key={character.id}>
                  <button type="button" className="character-open" onClick={() => setEditing(character)}>
                    <span className="character-name">{character.name}</span>
                    <span className="character-meta">{summary || 'Nothing chosen yet'}</span>
                    <span className={`character-status${done ? ' is-done' : ''}`}>
                      {done ? 'Complete' : `Next ${next?.label}`}
                    </span>
                  </button>

                  <div className="character-actions">
                    <button type="button" className="character-action" onClick={() => setEditing(character)}>
                      <FiEdit2 size={15} aria-hidden="true" />
                      {done ? 'Edit' : 'Resume'}
                    </button>

                    <button type="button" className="character-action" onClick={() => handleDuplicate(character)} disabled={duplicating !== null}>
                      <FiCopy size={15} aria-hidden="true" />
                      {duplicating === character.id ? 'Duplicating...' : 'Duplicate'}
                    </button>

                    <button type="button" className="character-delete" aria-label={`Delete ${character.name}`} onClick={() => setDeleting(character)}>
                      <FiTrash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      {editing && (
        <CharacterModal character={editing === 'new' ? undefined : editing} onSave={save} onClose={() => setEditing(null)} />
      )}

      {deleting && (
        <ConfirmDelete
          title={`Delete ${deleting.name}?`}
          body="This character and everything chosen for it will be gone for good. This action cannot be undone."
          confirmLabel="Delete character"
          busyLabel="Deleting..."
          onConfirm={() => remove(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}