import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const rpc = vi.hoisted(() => vi.fn())
const from = vi.hoisted(() => vi.fn())

vi.mock('@shared/lib/supabase/client', () => ({ supabase: { rpc, from } }))

import {
  USERNAME_REGEX, isValidUsername, isUsernameAvailable, usernameWriteProblem, USERNAME_MESSAGES,
} from '@shared/lib/auth/username-rules'

// Audit du 2026-10-04 (CPT-09). Les trois écrans où l'on saisit un pseudo
// portaient chacun leur copie de la règle — l'un des trois ne contrôlait que
// la longueur — et demandaient « est-il libre ? » à la table `profiles`, qu'un
// visiteur ne peut pas lire : la réponse était toujours « libre ».
describe('règle du pseudo', () => {
  it.each(['Foodie_42', 'Chef-1234', 'abc', 'a'.repeat(20), '_onde_', 'A-B_c'])('accepte « %s »', (pseudo) => {
    expect(isValidUsername(pseudo)).toBe(true)
  })

  it.each([
    ['2 caractères', 'ab'],
    ['21 caractères', 'a'.repeat(21)],
    ['un accent', 'Zoé'],
    ['une espace', 'Jean Dupont'],
    ['un point', 'marie.durand'],
    ['du HTML', '<b>Zo</b>'],
    ['une lettre cyrillique', '\u0410dmin'],
    ['rien', ''],
  ])('refuse %s', (_cas, pseudo) => {
    expect(isValidUsername(pseudo)).toBe(false)
  })

  it('refuse ce qui n’est pas du texte', () => {
    expect(isValidUsername(null)).toBe(false)
    expect(isValidUsername(undefined)).toBe(false)
    expect(isValidUsername(42)).toBe(false)
  })

  it('la règle est la même que celle de la base (20261004_inscription_sans_impasse.sql)', () => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261004_inscription_sans_impasse.sql'), 'utf8')
    // Même classe de caractères, mêmes bornes : si l'une change, l'autre aussi.
    expect(sql).toContain("'^[A-Za-z0-9_-]{3,20}$'")
    expect(USERNAME_REGEX.source).toBe('^[a-zA-Z0-9_-]{3,20}$')
  })
})

describe('« ce pseudo est-il libre ? »', () => {
  beforeEach(() => { rpc.mockReset(); from.mockReset() })

  it('le demande à la fonction de la base, pas à la table profiles', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    await isUsernameAvailable('Foodie_42')
    expect(rpc).toHaveBeenCalledWith('username_available', { p_username: 'Foodie_42' })
    expect(from).not.toHaveBeenCalled()
  })

  it('rend vrai quand la base dit libre', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    expect(await isUsernameAvailable('Foodie_42')).toBe(true)
  })

  it('rend faux quand la base dit pris ou réservé', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    expect(await isUsernameAvailable('Admin')).toBe(false)
  })

  it('rend null quand on n’a pas pu le savoir (erreur rendue)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
    expect(await isUsernameAvailable('Foodie_42')).toBeNull()
  })

  it('rend null quand on n’a pas pu le savoir (appel qui lève)', async () => {
    rpc.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await isUsernameAvailable('Foodie_42')).toBeNull()
  })
})

describe('erreur rendue à l’écriture d’un pseudo', () => {
  it('index d’unicité (23505) : pris', () => {
    expect(usernameWriteProblem({ code: '23505', message: 'duplicate key value violates unique constraint "profiles_username_lower_idx"' })).toBe('taken')
  })

  it('pseudo réservé : pris', () => {
    expect(usernameWriteProblem({ code: '23514', message: 'reserved_username: this username is reserved' })).toBe('taken')
  })

  it('règle de forme refusée par la base : invalide', () => {
    expect(usernameWriteProblem({ code: '23514', message: 'invalid_username: 3 to 20 letters, digits, _ or -' })).toBe('invalid')
  })

  it('contrainte de longueur de la table : invalide', () => {
    expect(usernameWriteProblem({ code: '23514', message: 'new row for relation "profiles" violates check constraint "username_length"' })).toBe('invalid')
  })

  it('toute autre erreur : pas un problème de pseudo', () => {
    expect(usernameWriteProblem({ code: '42501', message: 'forbidden: cannot modify privileged profile columns' })).toBeNull()
    expect(usernameWriteProblem({ message: 'Failed to fetch' })).toBeNull()
    expect(usernameWriteProblem(null)).toBeNull()
  })
})

describe('messages', () => {
  it('existent dans les deux langues, et la règle y est dite en clair', () => {
    for (const lang of ['fr', 'en']) {
      expect(USERNAME_MESSAGES[lang].taken).toBeTruthy()
      for (const cle of ['hint', 'invalid']) {
        expect(USERNAME_MESSAGES[lang][cle]).toMatch(/3/)
        expect(USERNAME_MESSAGES[lang][cle]).toMatch(/20/)
      }
    }
    expect(USERNAME_MESSAGES.fr.hint).toMatch(/sans accent/)
    expect(USERNAME_MESSAGES.fr.invalid).toMatch(/sans accent/)
  })

  it('jamais le message SQL brut : les trois écrans passent par ce module', () => {
    for (const fichier of [
      'src/features/auth/pages/signup-page.jsx',
      'src/features/auth/pages/choose-username-page.jsx',
      'src/features/profile/pages/profile-identity-page.jsx',
    ]) {
      const source = readFileSync(resolve(process.cwd(), fichier), 'utf8')
      // (Des booléens, pas `toMatch` : un échec n'a pas à recopier tout le fichier.)
      expect(source.includes('@shared/lib/auth/username-rules'), `${fichier} passe par username-rules`).toBe(true)
      // Plus de lecture de `profiles` pour savoir si un pseudo est libre…
      expect(/\.ilike\(\s*'username'/.test(source), `${fichier} ne lit plus profiles pour l'unicité`).toBe(false)
      // …ni de copie locale de la règle.
      expect(/const USERNAME_REGEX\s*=/.test(source), `${fichier} n'a plus sa copie de la règle`).toBe(false)
    }
  })
})
