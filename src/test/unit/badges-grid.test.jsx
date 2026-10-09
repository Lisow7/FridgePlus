import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BadgesGrid from '@features/profile/components/badges-grid'

const badges = [
  { id: 'volume-1', theme: 'volume', emoji: '🍳', label: { fr: 'Première recette cuisinée', en: 'First recipe cooked' }, unlocked: true, isNextTier: false, progress: { current: 1, value: 1, threshold: 1 }, reward: { banner: 'veggies' } },
  { id: 'variety-10', theme: 'variety', emoji: '🌈', label: { fr: '10 recettes différentes', en: '10 different recipes' }, unlocked: false, isNextTier: true, progress: { current: 7, value: 7, threshold: 10 }, reward: { banner: 'aurora' } },
]
const t = {
  themeLabels: { regularity: 'Régularité', volume: 'Volume', variety: 'Variété', world: 'Monde' },
  badgeProgress: (v, th) => `${v} / ${th}`,
  badgeUnlockedA11y: 'débloqué',
  badgeLockedA11y: 'verrouillé',
  nextRewardLabel: '⭐ Prochaine récompense',
}
const props = { t, lang: 'fr', darkMode: false, border: '#000', textColor: '#000', mutedColor: '#666' }

describe('BadgesGrid', () => {
  it('affiche le label d\'un badge débloqué', () => {
    render(<BadgesGrid badges={badges} unlockedBanners={['veggies']} {...props} />)
    expect(screen.getByText('Première recette cuisinée')).toBeInTheDocument()
  })
  it('affiche la progression d\'un badge verrouillé', () => {
    render(<BadgesGrid badges={badges} unlockedBanners={[]} {...props} />)
    expect(screen.getByText('7 / 10')).toBeInTheDocument()
  })
  it('marque le prochain palier du thème (data-next)', () => {
    const { container } = render(<BadgesGrid badges={badges} unlockedBanners={[]} {...props} />)
    expect(container.querySelector('[data-next="true"]')).toBeTruthy()
  })
  it('expose l\'état accessible (verrouillé)', () => {
    render(<BadgesGrid badges={badges} unlockedBanners={[]} {...props} />)
    expect(screen.getByLabelText(/10 recettes différentes — verrouillé/)).toBeInTheDocument()
  })
  it('chaque carte porte un id `badge-<id>` (cible du deep-link)', () => {
    render(<BadgesGrid badges={badges} unlockedBanners={['veggies']} {...props} />)
    expect(document.getElementById('badge-volume-1')).toBeTruthy()
    expect(document.getElementById('badge-variety-10')).toBeTruthy()
  })
  it('palier à récompense verrouillé : cadenas visible (aria-hidden, non textuel)', () => {
    const { container } = render(<BadgesGrid badges={badges} unlockedBanners={[]} {...props} />)
    const card = container.querySelector('#badge-variety-10')
    expect(card.querySelector('svg')).toBeTruthy() // LuLock
  })
  it('clignote sur le palier ciblé par targetId', () => {
    render(<BadgesGrid badges={badges} unlockedBanners={[]} targetId="variety-10" {...props} />)
    expect(document.getElementById('badge-variety-10').style.animation).toBeTruthy()
    expect(document.getElementById('badge-volume-1').style.animation).toBeFalsy()
  })
  it('affiche la pastille « prochaine récompense » sur le palier ciblé par nextRewardId', () => {
    render(<BadgesGrid badges={badges} unlockedBanners={[]} nextRewardId="variety-10" {...props} />)
    expect(screen.getByText('⭐ Prochaine récompense')).toBeInTheDocument()
  })
})
