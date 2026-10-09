import { describe, it, expect } from 'vitest'
import { CHANGELOG } from '@features/changelog/data/changelog'
import { RELEASE_NAMES_EN } from '@features/changelog/data/changelog-i18n'

// Bug UX audit 2026-07-17 : le titre d'une entrée CHANGELOG (v0.113) n'avait
// pas été traduit en EN — pickReleaseName retombe silencieusement sur le
// FR (fallback), donnant un titre français aux utilisateurs EN sans qu'aucun
// test ne le détecte. Erreur documentée comme "la plus fréquente" (cf.
// feedback_changelog_title_translation) : garde de régression permanente
// plutôt qu'un simple ajout ponctuel.
describe('RELEASE_NAMES_EN — complétude des traductions de titres', () => {
  it('chaque titre (name) du CHANGELOG a une traduction EN', () => {
    const missing = CHANGELOG
      .map(entry => entry.name)
      .filter(name => !(name in RELEASE_NAMES_EN))

    expect(missing).toEqual([])
  })
})
