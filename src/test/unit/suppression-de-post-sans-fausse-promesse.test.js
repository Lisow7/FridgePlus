import { describe, it, expect } from 'vitest'
import { COMMUNITY_I18N } from '@shared/lib/i18n/community-i18n'

// Lot 14e (audit du 2026-10-04, complément) : depuis la création de la
// communauté (v3.15.0, mai 2026), la confirmation de suppression promettait
// « Tu pourras le restaurer dans les 24 h depuis tes posts ». Aucun écran n'a
// jamais appelé `restorePost` (vérifié dans l'historique git) : la promesse
// était fausse dès le premier jour. Si une restauration voit le jour, elle
// viendra avec son écran — et ce test changera avec elle.
describe('la communauté ne promet pas de restaurer un post', () => {
  for (const lang of ['fr', 'en']) {
    it(`aucun texte ${lang} ne promet une restauration`, () => {
      const promesses = Object.entries(COMMUNITY_I18N[lang])
        .filter(([, texte]) => typeof texte === 'string' && /restaur(?!ant)|restore/i.test(texte))
        .map(([cle]) => cle)
      expect(promesses).toEqual([])
    })
  }
})
