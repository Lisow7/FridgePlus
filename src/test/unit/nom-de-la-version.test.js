import { describe, it, expect } from 'vitest'
import { CURRENT_VERSION, CURRENT_RELEASE_NAME } from '@shared/lib/version'
import { CHANGELOG } from '@features/changelog/data/changelog'
import { pickReleaseName } from '@features/changelog/data/changelog-i18n'

// Le badge du pied de page affiche le nom et le numéro de la dernière version.
// Il les lit dans `version.js`, pas dans le journal : le journal complet
// (85 Ko) partait au démarrage pour ces deux lignes (audit du 2026-10-04,
// PERF-04). Ce test tient `version.js` égal à la première entrée du journal :
// à la release, oublier l'un des deux fait échouer la CI.
describe('version courante = première entrée du journal', () => {
  it('le numéro', () => {
    expect(CURRENT_VERSION).toBe(CHANGELOG[0].version)
  })

  it('le nom, en français et en anglais', () => {
    expect(CURRENT_RELEASE_NAME.fr).toBe(pickReleaseName(CHANGELOG[0], 'fr'))
    expect(CURRENT_RELEASE_NAME.en).toBe(pickReleaseName(CHANGELOG[0], 'en'))
  })
})
