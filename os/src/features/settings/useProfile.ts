import { usePersistedState } from '../../shared/usePersistedState'
import { asString, isRecord } from '../../shared/validate'

/*
 * Cine ești în cardul de sus din Settings.
 *
 * Până acum numele era scris în cod („Roberto") și avatarul era litera „R",
 * tot în cod — deci cardul arăta la fel pentru oricine ar fi deschis
 * aplicația, și nu se putea schimba fără o modificare de sursă.
 */

const STORAGE_KEY = 'gym-app:profile'

export interface Profile {
  name: string
  /** Poza, ca `data:` URL redimensionat. Lipsește când n-a fost aleasă niciuna. */
  avatar?: string
}

const EMPTY_PROFILE: Profile = { name: '' }

/** Peste atât, poza nu mai încape rezonabil în `localStorage` lângă restul datelor. */
export const MAX_AVATAR_BYTES = 120_000

function recover(parsed: unknown): { value: Profile; dropped: number } {
  if (!isRecord(parsed)) return { value: EMPTY_PROFILE, dropped: 0 }
  const avatar = asString(parsed.avatar)
  return {
    value: {
      name: asString(parsed.name),
      // Doar `data:` URL-uri: în `src` unei imagini, un `http://…` salvat de
      // altcineva ar fi o cerere către un server străin la fiecare deschidere
      // a ecranului.
      avatar: avatar.startsWith('data:image/') ? avatar : undefined,
    },
    dropped: 0,
  }
}

/** `Roberto Iosif` → `RI`, `Roberto` → `R`, gol → `?`. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  return words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join('')
}

export function useProfile() {
  const { value, update, error, dismissError } = usePersistedState<Profile>(STORAGE_KEY, EMPTY_PROFILE, recover)

  function setName(name: string): boolean {
    return update((prev) => ({ ...prev, name }))
  }

  function setAvatar(avatar: string | undefined): boolean {
    return update((prev) => {
      const next: Profile = { ...prev }
      if (avatar) next.avatar = avatar
      else delete next.avatar
      return next
    })
  }

  return { profile: value, setName, setAvatar, error, dismissError }
}
