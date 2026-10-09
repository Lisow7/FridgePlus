import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// Toute surcouche plein écran est une boîte de dialogue (audit du 2026-10-04,
// A11Y-01).
//
// Vingt surcouches avaient été écrites à la main : ni rôle ni nom, Tab qui
// partait derrière, Échap qui ne fermait rien. Ce relevé repère chaque racine
// plein écran (`position: 'fixed'` + `inset: 0`, ou `fixed inset-0`) et exige
// que son fichier en fasse une boîte de dialogue : `useDialogue`, `role="dialog"`
// avec `useFocusTrap`, ou une brique commune (ReusableModal, ConfirmModal,
// BottomSheet). Les seules exceptions sont écrites ici, avec leur raison.
//
// Cliquet : un NOUVEAU fichier fautif casse ; la dette ne fait que fondre (une
// entrée réparée doit sortir de la liste).

const RACINE = join(__dirname, '../..')

const NON_DIALOGUES = {
  'app/layout/app-shell.jsx': 'calque décoratif aria-hidden',
  'shared/ui/menu-shell.jsx': 'fond d’un menu (role="menu"), aria-hidden',
  'features/cart/components/shared-basket-page.jsx': 'page plein écran (A11Y-14)',
  'features/community/components/community-page.jsx': 'page plein écran (A11Y-14)',
  'features/cooking-mode/components/cooking-mode-page.jsx': 'page plein écran (A11Y-14)',
}

// Dette du 2026-10-05 : à vider (lot 9b).
const DETTE = []

function fichiers(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) return fichiers(chemin)
    return /\.jsx$/.test(nom) ? [chemin] : []
  })
}

const RACINE_PLEIN_ECRAN = /position:\s*['"]fixed['"][^}]{0,200}?\binset:\s*['"]?0|\binset:\s*['"]?0['"]?,?[^}]{0,200}?position:\s*['"]fixed['"]|\bfixed inset-0\b/
// `aria-modal` : une boîte déclarée modale (son piège de focus peut vivre dans
// un hook, comme pour la fiche et le formulaire de recette).
const EST_UN_DIALOGUE = /useDialogue\(|<ReusableModal\b|<ConfirmModal\b|<BottomSheet\b|aria-modal/

const releve = fichiers(RACINE)
  .map((f) => ({ fichier: relative(RACINE, f).replace(/\\/g, '/'), source: readFileSync(f, 'utf8') }))
  .filter(({ source }) => RACINE_PLEIN_ECRAN.test(source))

describe('toute surcouche plein écran est une boîte de dialogue', () => {
  it('le relevé trouve des surcouches (témoin)', () => {
    expect(releve.length).toBeGreaterThan(20)
  })

  it('aucun fichier fautif hors de la dette', () => {
    const fautifs = releve
      .filter(({ fichier, source }) => !NON_DIALOGUES[fichier] && !EST_UN_DIALOGUE.test(source))
      .map(({ fichier }) => fichier)
      .filter((f) => !DETTE.includes(f))
    expect(fautifs).toEqual([])
  })

  it('la dette ne ment pas : une entrée réparée sort de la liste', () => {
    const repares = DETTE.filter((f) => {
      const trouve = releve.find((r) => r.fichier === f)
      return !trouve || EST_UN_DIALOGUE.test(trouve.source)
    })
    expect(repares).toEqual([])
  })
})
