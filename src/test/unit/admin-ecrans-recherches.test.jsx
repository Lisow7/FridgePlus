import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

const admin = vi.hoisted(() => ({
  adminGetIngredients: vi.fn(), adminGetIngredientById: vi.fn(), adminUpsertIngredient: vi.fn(), adminDeleteIngredient: vi.fn(),
  adminGetBaseRecipes: vi.fn(), adminGetBaseRecipeById: vi.fn(), adminUpsertBaseRecipe: vi.fn(), adminDeleteBaseRecipe: vi.fn(),
  adminGetFavoriteCountsByIds: vi.fn(), countMissingImageBaseRecipes: vi.fn(),
  adminGetLogs: vi.fn(), adminGetHealthChecks: vi.fn(), adminGetRecipesByIds: vi.fn(), adminGetUsersByIds: vi.fn(),
  adminGetUsers: vi.fn(), adminGetUserCounts: vi.fn(), adminToggleBan: vi.fn(), adminRevelerCompte: vi.fn(),
  adminGetUserProfile: vi.fn(), adminGrantSpecialAccess: vi.fn(), adminRevokeSpecialAccess: vi.fn(),
  adminGetImportQueue: vi.fn(), adminGetImportMetrics: vi.fn(), adminPublishStaged: vi.fn(), adminRejectStaged: vi.fn(),
  adminBatchPublishValid: vi.fn(), adminReRunValidators: vi.fn(),
}))
const communaute = vi.hoisted(() => ({
  adminListPosts: vi.fn(), adminListCommunityReports: vi.fn(), adminSoftDeletePost: vi.fn(),
  adminHardDeletePost: vi.fn(), adminMuteUser: vi.fn(), adminUnmuteUser: vi.fn(),
}))
const avis = vi.hoisted(() => ({
  adminListReviews: vi.fn(), adminListReviewReports: vi.fn(), adminSoftDeleteReview: vi.fn(), adminHardDeleteReview: vi.fn(),
}))
const drapeaux = vi.hoisted(() => ({ loadFeatureFlags: vi.fn(), setFeatureFlag: vi.fn(), fetchFeatureFlags: vi.fn() }))
const etatAdmin = vi.hoisted(() => ({ statsError: null }))

vi.mock('@features/admin/api/admin', () => admin)
vi.mock('@features/admin/api/community-admin', () => communaute)
vi.mock('@features/admin/api/recipe-reviews-admin', () => avis)
vi.mock('@shared/api/feature-flags', () => drapeaux)
vi.mock('@shared/contexts/feature-flags-provider', () => ({ useFeatureFlags: () => ({ reload: vi.fn() }), useFeatureFlag: () => true }))
vi.mock('@features/admin/providers/admin-provider', () => ({
  useAdmin: () => ({
    refreshStats: vi.fn(), focusEditId: null, setFocusEditId: vi.fn(), setSection: vi.fn(),
    stats: {}, statsLoading: false, statsError: etatAdmin.statsError,
    pendingCount: 0, supportBadge: 0, healthCount: 0, reportsCount: 0,
  }),
}))
vi.mock('@shared/contexts/data-provider', () => ({ useCountries: () => [], useAllergenTypes: () => [], useIngredientsById: () => ({}) }))
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({ useConfirm: () => async () => true }))
vi.mock('@shared/ui/pagination', () => ({ default: () => null }))
vi.mock('@shared/ui/avatar-img', () => ({ default: () => null }))
vi.mock('@features/admin/components/shared/analytics-chart', () => ({ default: () => null }))

import IngredientsSection from '@features/admin/components/sections/ingredients-section'
import BaseRecipesSection from '@features/admin/components/sections/base-recipes-section'
import FeaturesSection from '@features/admin/components/sections/features-section'
import Dashboard from '@features/admin/components/dashboard'
import CommunitySection from '@features/admin/components/sections/community-section'
import RecipeReviewsAdminSection from '@features/admin/components/sections/recipe-reviews-section'
import DataQualitySection from '@features/admin/components/sections/data-quality-section'
import JournalSection from '@features/admin/components/sections/journal-section'

const RESEAU = { message: 'Failed to fetch' }
// Lève À L'APPEL (pas de promesse rejetée) — voir admin-chargements-rates.test.jsx.
const leve = (e) => () => { throw Object.assign(new Error(e.message), e.code ? { code: e.code } : {}) }
const attendre = (ms) => act(() => new Promise((r) => setTimeout(r, ms)))

beforeEach(() => {
  for (const api of [admin, communaute, avis, drapeaux]) Object.values(api).forEach((m) => m.mockReset())
  etatAdmin.statsError = null
  admin.adminGetIngredients.mockResolvedValue({ data: [], count: 0, error: null })
  admin.adminGetBaseRecipes.mockResolvedValue({ data: [], count: 0, error: null })
  admin.countMissingImageBaseRecipes.mockResolvedValue(0)
  admin.adminGetLogs.mockResolvedValue({ data: [], count: 0, error: null })
  admin.adminGetUserCounts.mockResolvedValue({ all: 0, active: 0, banned: 0, admins: 0 })
  admin.adminGetUsers.mockResolvedValue({ data: [], count: 0, error: null })
  communaute.adminListPosts.mockResolvedValue([])
  communaute.adminListCommunityReports.mockResolvedValue([])
  avis.adminListReviews.mockResolvedValue([])
  avis.adminListReviewReports.mockResolvedValue([])
  drapeaux.loadFeatureFlags.mockResolvedValue({ data: [], error: null })
})

async function attendreLEchec(texte = 'Le chargement a échoué') {
  const alerte = await screen.findByRole('alert')
  expect(alerte).toHaveTextContent(texte)
  return alerte
}

// Audit du 2026-10-04, ADM-09 : quatre écrans réécrivaient à la main le cycle
// de chargement — sans `finally`, sans garde contre une réponse obsolète — et
// ADM-08 : un échec s'y affichait comme « aucune donnée ».
describe('les écrans du panneau disent un chargement raté', () => {
  it('Ingrédients', async () => {
    admin.adminGetIngredients.mockResolvedValue({ data: null, count: null, error: RESEAU })
    render(<IngredientsSection lang="fr" />)
    await attendreLEchec()
    expect(screen.queryByText('Aucun ingrédient.')).toBeNull()
  })

  it('Recettes base', async () => {
    admin.adminGetBaseRecipes.mockResolvedValue({ data: null, count: null, error: RESEAU })
    render(<BaseRecipesSection lang="fr" />)
    await attendreLEchec()
    expect(screen.queryByText('Aucune recette de base.')).toBeNull()
  })

  it('Recettes base : les compteurs de favoris échouent — la liste s’affiche quand même, sans rester sur « Chargement… »', async () => {
    admin.adminGetBaseRecipes.mockResolvedValue({ data: [{ id: 'tarte', name: { fr: 'Tarte aux pommes' }, emoji: '🥧' }], count: 1, error: null })
    admin.adminGetFavoriteCountsByIds.mockImplementation(leve(RESEAU))
    render(<BaseRecipesSection lang="fr" />)
    expect(await screen.findByText(/Tarte aux pommes/)).toBeInTheDocument()
    expect(screen.queryByText('Chargement…')).toBeNull()
  })

  it('Fonctionnalités', async () => {
    drapeaux.loadFeatureFlags.mockResolvedValue({ data: [], error: RESEAU })
    render(<FeaturesSection lang="fr" />)
    await attendreLEchec()
    expect(screen.queryByText('Aucune fonctionnalité configurée.')).toBeNull()
  })

  it('Fonctionnalités : une bascule refusée est dite', async () => {
    drapeaux.loadFeatureFlags.mockResolvedValue({ data: [{ key: 'scan_barcode', enabled: false, label: 'Scan' }], error: null })
    drapeaux.setFeatureFlag.mockResolvedValue({ error: { code: 'no_rows_affected', message: 'no_rows_affected' } })
    render(<FeaturesSection lang="fr" />)
    fireEvent.click(await screen.findByRole('button', { pressed: false }))
    await attendreLEchec('Rien n\'a été modifié')
  })

  it('Tableau de bord : l’activité récente pas chargée — pas « Aucune activité »', async () => {
    admin.adminGetLogs.mockResolvedValue({ data: null, count: null, error: RESEAU })
    render(<Dashboard lang="fr" />)
    await attendreLEchec()
    expect(screen.queryByText('Aucune activité')).toBeNull()
  })

  it('Tableau de bord : les compteurs pas chargés — c’est dit', async () => {
    etatAdmin.statsError = Object.assign(new Error('permission denied'), { code: '42501' })
    render(<Dashboard lang="fr" />)
    await attendreLEchec('Les compteurs n\'ont pas pu être chargés')
    // Le badge des signalements part de 0 : sans compteurs lus, la carte dit « — », pas « 0 ».
    expect(screen.queryByText('0')).toBeNull()
  })

  it('Qualité : une lecture qui lève est dite, pas « 100 % »', async () => {
    admin.adminGetHealthChecks.mockImplementation(leve(RESEAU))
    render(<DataQualitySection lang="fr" />)
    await attendreLEchec('Analyse impossible')
  })

  // Utilisateurs : les e-mails ne se chargent plus à l'ouverture de l'onglet
  // (audit ADM-05, 2026-10-08) ; une révélation refusée est dite dans le
  // rideau — voir `consultations-tracees.test.jsx`.
})

describe('les recherches attendent qu’on cesse de taper (300 ms)', () => {
  it.each([
    ['Ingrédients', () => <IngredientsSection lang="fr" />, 'Rechercher un ingrédient', admin.adminGetIngredients, (a) => a.search],
    ['Recettes base', () => <BaseRecipesSection lang="fr" />, 'Rechercher une recette', admin.adminGetBaseRecipes, (a) => a.search],
    ['Communauté', () => <CommunitySection />, 'Rechercher un titre', communaute.adminListPosts, (a) => a.search],
    ['Avis', () => <RecipeReviewsAdminSection />, 'Rechercher un commentaire', avis.adminListReviews, (a) => a.search],
  ])('%s : trois lettres tapées vite, une seule requête', async (_, ecran, libelle, lecture, recherche) => {
    render(ecran())
    await waitFor(() => expect(lecture).toHaveBeenCalledTimes(1))
    // Le libellé est écrit à côté du champ (décision du 2026-10-06).
    const champ = screen.getByLabelText(libelle)
    fireEvent.change(champ, { target: { value: 't' } })
    fireEvent.change(champ, { target: { value: 'to' } })
    fireEvent.change(champ, { target: { value: 'tom' } })
    await attendre(450)
    expect(lecture).toHaveBeenCalledTimes(2)
    expect(recherche(lecture.mock.calls[1][0])).toBe('tom')
  })
})

// Audit ADM-10 : le tri ne rangeait que la page affichée. Il part désormais à
// la base, et revient à la première page (la page 3 d'un autre ordre ne veut
// rien dire) ; les favoris, comptés page par page, le disent.
describe('catalogues — le tri choisi part à la base', () => {
  it('ingrédients : « Nom » relit le catalogue trié par nom, depuis la première page', async () => {
    render(<IngredientsSection />)
    await waitFor(() => expect(admin.adminGetIngredients).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Nom' }))
    await waitFor(() => expect(admin.adminGetIngredients).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'name', page: 0 })))
  })

  it('recettes de base : « Type » part à la base ; le tri des favoris dit « cette page »', async () => {
    render(<BaseRecipesSection />)
    await waitFor(() => expect(admin.adminGetBaseRecipes).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Type' }))
    await waitFor(() => expect(admin.adminGetBaseRecipes).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'type', page: 0 })))
    expect(screen.getByRole('button', { name: 'Favoris (cette page)' })).toBeInTheDocument()
  })
})

describe('journal — les filtres partent à la base', () => {
  it('une catégorie demande ses actions à la base, depuis la première page', async () => {
    render(<JournalSection lang="fr" />)
    await waitFor(() => expect(admin.adminGetLogs).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'RGPD' }))
    await waitFor(() => expect(admin.adminGetLogs).toHaveBeenLastCalledWith(0, expect.objectContaining({ actions: expect.arrayContaining(['profile_data_viewed']) })))
  })

  it('le pseudo de l’auteur part à la base quand on cesse de taper', async () => {
    render(<JournalSection lang="fr" />)
    await waitFor(() => expect(admin.adminGetLogs).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText('Filtrer par admin'), { target: { value: 'antoine' } })
    await attendre(450)
    expect(admin.adminGetLogs).toHaveBeenLastCalledWith(0, expect.objectContaining({ auteur: 'antoine' }))
  })
})
