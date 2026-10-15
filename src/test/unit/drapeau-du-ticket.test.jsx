import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// Décision du 2026-10-08 : le drapeau de la photo du ticket « coupe vraiment ».
// Éteint, la visite guidée et la carte « Bien démarrer » n’en parlent plus, et le
// bandeau hors ligne d’un invité ne la promet plus. (La FAQ et le guide, pages
// publiques préparées à l’avance, la décrivent toujours ; le serveur refuse —
// fonction `scan-receipt`.)

const drapeau = vi.hoisted(() => ({ photo: false }))
vi.mock('@shared/contexts/feature-flags-provider', () => ({
  useFeatureFlag: (cle, repli) => (cle === 'receipt_scan' ? drapeau.photo : repli),
}))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@shared/contexts/ui-provider', () => ({ useLang: () => ({ lang: 'fr' }) }))

import BandeauHorsLigne from '@app/components/bandeau-hors-ligne'
import GettingStartedCard from '@features/onboarding/components/getting-started-card'
import TourWizard from '@features/onboarding/components/tour-wizard'

let enLigne = true
beforeEach(() => {
  enLigne = true
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => enLigne)
})
afterEach(() => { vi.restoreAllMocks() })

const etapeDuFrigo = () => {
  render(<TourWizard lang="fr" user={null} onClose={() => {}} onAction={{}} />)
  fireEvent.click(screen.getByRole('button', { name: /Suivant/ }))
  expect(screen.getByText('Remplis ton frigo')).toBeInTheDocument()
}

describe.each([
  [false, 'éteint'],
  [true, 'allumé'],
])('drapeau de la photo du ticket %s', (photo) => {
  beforeEach(() => { drapeau.photo = photo })

  it('le bandeau hors ligne d’un invité', () => {
    render(<BandeauHorsLigne />)
    act(() => { enLigne = false; window.dispatchEvent(new Event('offline')) })
    expect(screen.getByRole('status')).toHaveTextContent(photo
      ? 'Pas de réseau. La voix et la photo du ticket attendront son retour.'
      : 'Pas de réseau. La voix attendra son retour.')
  })

  it('la carte « Bien démarrer »', () => {
    render(<GettingStartedCard lang="fr" isGuest stepsTotal={2} stepsDone={0} onCollapse={() => {}} state="s1" onQuickAdd={() => {}} />)
    if (photo) expect(screen.getByText('Photographie ton ticket')).toBeInTheDocument()
    else expect(screen.queryByText('Photographie ton ticket')).toBeNull()
  })

  it('l’étape « Remplis ton frigo » de la visite', () => {
    etapeDuFrigo()
    if (photo) {
      expect(screen.getByText('QUATRE FAÇONS, AU CHOIX')).toBeInTheDocument()
      expect(screen.getByText('Photographie ton ticket')).toBeInTheDocument()
    } else {
      expect(screen.getByText('TROIS FAÇONS, AU CHOIX')).toBeInTheDocument()
      expect(screen.queryByText('Photographie ton ticket')).toBeNull()
      expect(document.body.textContent).not.toMatch(/la photo|appareil photo/)
    }
  })
})

describe('le serveur refuse la photo du ticket quand le drapeau est éteint', () => {
  // La fonction Deno ne s’exécute pas ici : on lit son source. Le refus doit venir
  // AVANT l’appel à Google Vision et avant le décompte du quota.
  it('scan-receipt lit le drapeau et répond 403 « feature_disabled »', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync('supabase/functions/scan-receipt/index.ts', 'utf8')
    const drapeau = source.indexOf(".from('feature_flags').select('enabled').eq('key', 'receipt_scan')")
    const refus = source.indexOf("error: 'feature_disabled' }), { status: 403")
    const vision = source.indexOf('vision.googleapis.com')
    expect(drapeau).toBeGreaterThan(-1)
    expect(refus).toBeGreaterThan(drapeau)
    if (vision > -1) expect(refus).toBeLessThan(vision)
  })
})
