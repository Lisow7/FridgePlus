import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, fireEvent } from '@testing-library/react'

// Les trois branchements de la récupération d'une version périmée (audit du
// 2026-10-04, SEO-08). La logique est prouvée dans `version-perimee.test.js`
// et `banniere-rouverte-au-retour.test.js` ; ici, qu'elle est bien appelée.

const recharger = vi.hoisted(() => vi.fn())
vi.mock('@features/pwa/lib/version-perimee', () => ({ rechargerSurLaDerniereVersion: recharger }))
vi.mock('@shared/lib/observability/sentry', () => ({ logError: () => {} }))

import ErrorBoundary from '@app/error/error-boundary'

function Boum() {
  throw new Error('morceau perdu')
}

const lire = (chemin) => readFileSync(resolve(__dirname, '../..', chemin), 'utf8')

describe('l’écran d’erreur recharge sur la dernière version', () => {
  it('niveau application : « Recharger la page » passe par la version en attente', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary level="app" lang="fr"><Boum /></ErrorBoundary>)
    fireEvent.click(screen.getByRole('button', { name: 'Recharger la page' }))
    expect(recharger).toHaveBeenCalledTimes(1)
  })

  it('niveau section : « Réessayer » ne recharge rien, il rejoue la section', () => {
    recharger.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary level="section" lang="fr"><Boum /></ErrorBoundary>)
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(recharger).not.toHaveBeenCalled()
  })
})

describe('les branchements au démarrage et dans la bannière', () => {
  // Le module virtuel du plugin PWA n'existe pas sous Vitest : ces deux
  // branchements sont vérifiés dans le code, et au navigateur sur un build.
  it('main.jsx installe la récupération AVANT de précharger la route et de monter l’app', () => {
    const main = lire('main.jsx')
    expect(main).toMatch(/import \{ installerLaRecuperation \} from '@features\/pwa\/lib\/version-perimee'/)
    const appel = main.indexOf('installerLaRecuperation()')
    expect(appel).toBeGreaterThan(-1)
    expect(appel).toBeLessThan(main.indexOf('prechargerLaRoute(window.location.pathname'))
  })

  it('la bannière rouvre sur une version en attente au retour d’onglet', () => {
    const banniere = lire('features/pwa/components/update-prompt.jsx')
    expect(banniere).toMatch(/creerRetourDOnglet\(\{[\s\S]*?onVersionEnAttente: \(\) => setNeedRefresh\(true\)/)
    expect(banniere).toMatch(/addEventListener\('visibilitychange', onVisibilityChange\)/)
  })
})
