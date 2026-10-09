import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Audit du 2026-10-04, ADM-21 : sur une même ligne de la Communauté, « Masquer
// (soft-delete) », un bouton « Supprimer » qui supprime DÉFINITIVEMENT (dit
// seulement dans son infobulle), puis « Unmute » et « Mute ». L'admin ne savait
// pas, avant de cliquer, si l'action se rattrape.
// Glossaire : « Masquer » = réversible ; « Supprimer définitivement » =
// irréversible, ce mot toujours écrit ; « sourdine » (comme le journal).

const sansCommentaires = (chemin) => readFileSync(resolve(process.cwd(), chemin), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

describe('modération de la communauté — des mots qui disent si ça se rattrape', () => {
  const source = sansCommentaires('src/features/admin/components/sections/community-section.jsx')

  it('ni jargon ni anglais', () => {
    expect(source).not.toMatch(/soft-delete/i)
    expect(source).not.toMatch(/\b(Unmute|Mute)\b/)
    expect(source).not.toMatch(/muté|\bMuter\b|le mute\b/)
  })

  it('le bouton irréversible écrit « définitivement », le réversible le dit aussi', () => {
    expect(source).toMatch(/<LuTrash2 size=\{12\} \/> Supprimer définitivement/)
    expect(source).toMatch(/title="Masquer \(réversible\)"/)
  })
})
