/**
 * Bug UX audit 2026-07-17 — la recherche de recettes n'était pas insensible
 * aux accents ("creme" → 0 résultat sur "Crème brûlée"). Teste la logique
 * pure du prédicat sans rendre le hook use-recipe-filters (qui dépend de
 * contextes Supabase/router), même convention que recipe-functional-tag-filters.test.js.
 */

import { describe, it, expect } from 'vitest'

// ─── Prédicat extrait de use-recipe-filters.js (matchesSearch) ──────────────
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const matchesSearch = (name, q) => !q.trim() || norm(name).includes(norm(q))

describe('Recherche de recettes — insensible aux accents', () => {
  it('"creme" (sans accent) matche "Crème brûlée"', () => {
    expect(matchesSearch('Crème brûlée', 'creme')).toBe(true)
  })

  it('"crème" (avec accent) matche toujours "Crème brûlée"', () => {
    expect(matchesSearch('Crème brûlée', 'crème')).toBe(true)
  })

  it('reste insensible à la casse', () => {
    expect(matchesSearch('Crème brûlée', 'CREME')).toBe(true)
  })

  it('requête vide matche tout', () => {
    expect(matchesSearch('Crème brûlée', '')).toBe(true)
  })

  it('ne matche pas un nom sans rapport', () => {
    expect(matchesSearch('Crème brûlée', 'guacamole')).toBe(false)
  })
})
