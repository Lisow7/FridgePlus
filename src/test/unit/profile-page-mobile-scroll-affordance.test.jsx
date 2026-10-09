import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Bug UX audit 2026-07-17 : sur mobile (<640px), la barre d'onglets profil
// scrolle horizontalement mais sans AUCUN indice visuel — "Mes dépenses" et
// "Compte & sécurité" (derniers onglets) sont invisibles et rien ne suggère
// qu'il faut swiper pour les découvrir.

vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'u1' }, profile: {}, isAdmin: false }),
}))
vi.mock('@shared/hooks/use-subscription', () => ({
  useSubscription: () => ({ isPremium: false, isTrialing: false, trialDaysLeft: 0, hasPremiumAccess: false }),
}))
vi.mock('@shared/hooks/use-window-width', () => ({ useWindowWidth: () => 390 }))
vi.mock('@features/profile/components/profile-sidebar', () => ({ default: () => null }))
vi.mock('@features/profile/components/avatar-picker-modal', () => ({ default: () => null }))

import ProfilePage from '@features/profile/pages/profile-page'

function setup() {
  return render(
    <MemoryRouter initialEntries={['/profile/identite']}>
      <Routes>
        <Route path="/profile/*" element={<ProfilePage lang="fr" />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProfilePage — affordance de scroll sur la barre d\'onglets mobile', () => {
  it('la nav applique un masque de fondu (mask-image) indiquant que le contenu continue', () => {
    setup()
    const nav = screen.getByRole('tablist', { name: /navigation profil/i })
    // jsdom n'implémente pas de getter camelCase pour mask-image (propriété CSS
    // non supportée par son CSSOM) — React l'écrit bien dans l'attribut style
    // brut, donc on vérifie là plutôt que via nav.style.maskImage (toujours vide).
    expect(nav.getAttribute('style')).toMatch(/mask-image:\s*linear-gradient/)
  })
})
