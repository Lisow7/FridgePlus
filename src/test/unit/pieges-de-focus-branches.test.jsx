import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// Audit du 2026-10-04, lot 9g-2 (A11Y-08) : quatre dialogues appelaient `useFocusTrap(ref)`
// sans jamais poser `ref={…}` sur un élément — le hook sortait sans conteneur (ni Tab piégé,
// ni Échap, ni focus posé), et le garde-fou `surcouches-sont-des-dialogues` ne voyait rien :
// il se contente d'un `aria-modal` dans le fichier. Deux de ces dialogues n'avaient pas de
// nom non plus. Ici : le garde-fou qui manquait, et les trois dialogues joués.

const RACINE = join(__dirname, '../..')
const fichiers = (dossier) => readdirSync(dossier).flatMap((nom) => {
  const chemin = join(dossier, nom)
  if (statSync(chemin).isDirectory()) return nom === 'test' ? [] : fichiers(chemin)
  return /\.jsx?$/.test(nom) ? [chemin] : []
})
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
const sources = fichiers(RACINE).map((f) => ({ fichier: relative(RACINE, f).replace(/\\/g, '/'), source: sansCommentaires(readFileSync(f, 'utf8')) }))

// Les hooks qui ne posent pas la ref eux-mêmes : ils la RENDENT à l'écran qui l'utilise.
const HOOKS_QUI_RENDENT_LEUR_REF = {
  'shared/hooks/use-focus-trap.js': 'le hook lui-même',
  'shared/hooks/use-dialogue.js': 'rend `proprietes.ref`',
  'shared/hooks/use-dropdown-menu.js': 'rend `menuRef`',
  'features/recipes/hooks/use-recipe-modal.js': 'rend `dialogRef`',
  'features/recipes/hooks/use-recipe-form-modal.js': 'rend `dialogRef`',
}
// Dialogues déclarés en dur sans nom, admis avec leur raison — la liste ne fait que fondre.
const DIALOGUES_SANS_NOM_ADMIS = {
  'shared/ui/upgrade-gate.jsx': 'bulle du verrou Premium (PREM-15), fichier touché par #1307 : lot 15',
}

describe('chaque piège de focus a son conteneur', () => {
  it('le relevé trouve des pièges (témoin)', () => {
    expect(sources.filter(({ source }) => /useFocusTrap\(/.test(source)).length).toBeGreaterThan(10)
  })

  it('tout `useFocusTrap(x)` a un `ref={x}` dans le même fichier, sauf les hooks qui rendent la ref', () => {
    const orphelins = []
    for (const { fichier, source } of sources) {
      for (const m of source.matchAll(/useFocusTrap\((\w+)/g)) {
        const ref = m[1]
        if (HOOKS_QUI_RENDENT_LEUR_REF[fichier]) {
          expect(source.match(new RegExp(`\\b${ref}\\b`, 'g')).length, `${fichier} : ${ref} rendu`).toBeGreaterThan(1)
          continue
        }
        if (!new RegExp(`ref=\\{${ref}\\}`).test(source)) orphelins.push(`${fichier} : ${ref}`)
      }
    }
    expect(orphelins, 'un piège sans conteneur ne piège rien : poser ref={x} sur le dialogue, ou passer par useDialogue').toEqual([])
  })

  it('tout `role="dialog"` écrit en dur porte un nom (aria-label ou aria-labelledby), hors dette nommée', () => {
    const sansNom = []
    for (const { fichier, source } of sources) {
      for (const m of source.matchAll(/<\w+[^>]*?role="dialog"[^>]*?>/gs)) {
        if (!/aria-label(ledby)?=/.test(m[0]) && !DIALOGUES_SANS_NOM_ADMIS[fichier]) sansNom.push(fichier)
      }
    }
    expect([...new Set(sansNom)]).toEqual([])
  })
})

// ─── Les trois dialogues, joués ───────────────────────────────────────────────
const supabaseMock = vi.hoisted(() => ({ count: 2 }))
vi.mock('@shared/lib/supabase/client', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => Promise.resolve({ count: supabaseMock.count, error: null }) }) }) },
}))
vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: () => {} }))
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({ useConfirm: () => vi.fn() }))
vi.mock('@features/cart/components/cart-manual-add', () => ({ default: () => <button>article</button> }))
vi.mock('@features/cart/components/cart-suggestions-modal', () => ({ default: () => null }))
const pwa = vi.hoisted(() => ({ installable: true, ios: true, installed: false, deferredPrompt: null, setDeferredPrompt: () => {}, setInstalled: () => {} }))
vi.mock('@features/pwa/lib/use-pwa-installable', () => ({ usePwaInstallable: () => pwa }))

import EraseSpendingHistorySection from '@features/profile/components/erase-spending-history-section'
import AddItemSheet from '@features/cart/components/add-item-sheet'
import InstallButton from '@features/pwa/components/install-button'

describe('supprimer l’historique de dépenses : un vrai dialogue', () => {
  async function ouvrir() {
    render(<EraseSpendingHistorySection userId="u1" onErase={vi.fn()} lang="fr" defaultOpen />)
    await act(async () => { await Promise.resolve() })
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer mon historique' }))
    return screen.getByRole('dialog', { name: 'Supprimer ton historique de dépenses ?' })
  }

  it('a un nom, et le focus y entre à l’ouverture', async () => {
    const dialogue = await ouvrir()
    expect(dialogue.contains(document.activeElement)).toBe(true)
  })

  it('Échap le ferme', async () => {
    await ouvrir()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('ajouter un article au panier : le piège a son conteneur', () => {
  it('le focus entre dans la feuille à l’ouverture, Échap la ferme', () => {
    const onClose = vi.fn()
    render(<AddItemSheet open lang="fr" onClose={onClose} basket={[]} />)
    const dialogue = screen.getByRole('dialog', { name: 'Ajouter un article' })
    expect(dialogue.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})

describe('installer sur iPhone : le dialogue a un nom', () => {
  it('s’ouvre nommé par son titre, Échap le ferme', () => {
    render(<InstallButton lang="fr" />)
    fireEvent.click(screen.getByRole('button', { name: "Installer l'app" }))
    const dialogue = screen.getByRole('dialog', { name: 'Installer Fridge+ sur iPhone' })
    expect(dialogue.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
