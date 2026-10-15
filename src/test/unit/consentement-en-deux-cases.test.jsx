import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Décision du 2026-10-06, choix d'Antoine (« bandeau = deux_cases ») ;
// audit du 2026-10-04, RGPD-01. La case « Mesure d'audience » se disait
// « Sentry seul, anonyme » alors qu'elle autorisait AUSSI un suivi d'usage
// rattaché au compte. Elle se dédouble : « Rapports d'erreurs » (Sentry) et
// « Statistiques d'usage » (`product_events`). « Fonctionnels », qui ne
// commandait rien, disparaît. Le consentement passe en version 2 : chacun
// revoit le bandeau une fois.

const CLE = 'fridge-consent-v1' // gitleaks:allow

async function frais() {
  vi.resetModules()
  return await import('@shared/hooks/use-consent')
}

beforeEach(() => { localStorage.clear(); vi.resetModules() })

describe('deux choix séparés : rapports d’erreurs, statistiques d’usage', () => {
  it('un ancien choix (une seule case « audience ») ne vaut plus : le bandeau revient', async () => {
    localStorage.setItem(CLE, JSON.stringify({
      version: 1, timestamp: Date.now() - 1000, decisionAt: Date.now() - 1000, bannerDismissed: true,
      essential: true, functional: true, audience: true, voice: true, receiptScan: true,
    }))
    localStorage.setItem('fridge-anon-id', 'ancien')
    const { hasConsentedSync, getConsentSync } = await frais()
    expect(getConsentSync().bannerDismissed).toBe(false)
    expect(hasConsentedSync('errors')).toBe(false)
    expect(hasConsentedSync('usage')).toBe(false)
    expect(localStorage.getItem('fridge-anon-id'), 'l’identifiant du suivi d’usage part avec').toBeNull()
  })

  it('… mais les accords donnés au micro et à la photo de ticket restent : ce ne sont pas des cookies', async () => {
    localStorage.setItem(CLE, JSON.stringify({
      version: 1, timestamp: Date.now() - 1000, bannerDismissed: true, essential: true, audience: true, voice: true, receiptScan: true,
    }))
    const { hasConsentedSync } = await frais()
    expect(hasConsentedSync('voice')).toBe(true)
    expect(hasConsentedSync('receiptScan')).toBe(true)
  })

  it('« Tout accepter » donne les deux ; « Tout refuser » aucun ; plus de catégorie « fonctionnels »', async () => {
    const { useConsent, getConsentSync } = await frais()
    const { result } = renderHook(() => useConsent())
    act(() => result.current.accept())
    expect(getConsentSync()).toMatchObject({ version: 2, errors: true, usage: true })
    act(() => result.current.refuse())
    expect(getConsentSync()).toMatchObject({ errors: false, usage: false })
    expect(getConsentSync()).not.toHaveProperty('functional')
    expect(getConsentSync()).not.toHaveProperty('audience')
  })

  it('accepter les rapports d’erreurs SANS les statistiques : Sentry oui, suivi d’usage non, identifiant anonyme effacé', async () => {
    localStorage.setItem('fridge-anon-id', 'ancien')
    const { useConsent, hasConsentedSync } = await frais()
    const { result } = renderHook(() => useConsent())
    act(() => result.current.save({ errors: true, usage: false }))
    expect(hasConsentedSync('errors')).toBe(true)
    expect(hasConsentedSync('usage')).toBe(false)
    expect(localStorage.getItem('fridge-anon-id')).toBeNull()
  })
})

describe('chaque outil lit SA case', () => {
  const lire = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')

  it('Sentry : « errors », jamais « usage » ni l’ancienne « audience »', () => {
    const s = lire('src/shared/lib/observability/sentry.js')
    expect(s).toMatch(/hasConsentedSync\('errors'\)/)
    expect(s).toMatch(/if \(!consentement\.errors\) fermerSentry\(\)/)
    expect(s).not.toMatch(/'audience'|\.audience\b|'usage'/)
  })

  it('suivi d’usage et identifiant anonyme : « usage », jamais « errors » ni « audience »', () => {
    for (const f of ['src/shared/lib/observability/track.js', 'src/shared/lib/observability/anon-id.js']) {
      const s = lire(f)
      expect(s, f).toMatch(/hasConsentedSync\('usage'\)/)
      expect(s, f).not.toMatch(/'audience'|'errors'/)
    }
  })
})

describe('le panneau « Confidentialité » du profil montre les deux cases', () => {
  it('chacune avec son état ; plus de « Fonctionnels » ni de « Mesure d’audience »', async () => {
    vi.doMock('@shared/hooks/use-consent', () => ({
      useConsent: () => ({ consent: { timestamp: Date.now(), errors: true, usage: false }, hasDecided: true, reset: vi.fn() }),
    }))
    vi.doMock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: null }) }))
    vi.doMock('@features/push-notifications', () => ({ usePushSubscription: () => ({ available: false }) }))
    vi.doMock('@features/legal/components/cookie-modal', () => ({ default: () => null }))
    vi.doMock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => vi.fn() }))
    vi.doMock('@shared/api/community', () => ({ revokeCommunityTerms: vi.fn() }))
    const { render, screen } = await import('@testing-library/react')
    const { default: ConfidentialityPanel } = await import('@features/legal/components/confidentiality-panel')
    render(<ConfidentialityPanel lang="fr" />)
    const ligne = (titre) => screen.getByText(titre).parentElement.textContent
    expect(ligne("🔵 Rapports d’erreurs")).toMatch(/Accepté/)
    expect(ligne("🟣 Statistiques d’usage")).toMatch(/Refusé/)
    expect(screen.queryByText(/Fonctionnels|Mesure d['’]audience/)).not.toBeInTheDocument()
  })
})

describe('la politique dit les deux choix', () => {
  it('fr et en : deux choix séparés, nommés comme dans la fenêtre des cookies', async () => {
    const { getLegalSection } = await import('@features/legal/data/legal-content')
    const fr = JSON.stringify(getLegalSection('fr', 'privacy'))
    const en = JSON.stringify(getLegalSection('en', 'privacy'))
    expect(fr).toMatch(/« Rapports d['’]erreurs » \(Sentry\) et « Statistiques d['’]usage » → consentement \(Art\. 6\.1\.a\), deux choix séparés/)
    expect(en).toMatch(/“Error reports” \(Sentry\) and “Usage statistics” → consent \(Art\. 6\.1\.a\), two separate choices/)
    expect(fr).toMatch(/Sentry \/ Functional Software, Inc\. \(États-Unis\) : erreurs de l['’]application, si tu acceptes les rapports d['’]erreurs — rattachées à l['’]identifiant de ton compte, jamais à ton adresse e-mail/)
    expect(en).toMatch(/Sentry \/ Functional Software, Inc\. \(USA\): application errors, if you accept error reports — linked to your account['’]s identifier, never to your email address/)
  })
})
