// Le graphique d'analytics restait bloqué sur « Chargement… » quand sa requête
// échouait : `adminGetAnalyticsData().then(...)` n'avait pas de `.catch()`, donc
// `setLoading(false)` n'était jamais atteint.
//
// Même leçon que la régression de l'onglet Qualité (cf.
// admin-data-quality-error-state.test.jsx) : un écran d'administration qui ne
// dit pas qu'il a échoué est pire qu'un écran en panne — on attend un chiffre
// qui ne viendra jamais, sans savoir qu'il faut chercher ailleurs.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const { mockGetAnalyticsData } = vi.hoisted(() => ({ mockGetAnalyticsData: vi.fn() }))
vi.mock('@features/admin/api/admin', () => ({
  adminGetAnalyticsData: (...args) => mockGetAnalyticsData(...args),
}))
// recharts mesure son parent et n'a rien à voir avec ce qu'on vérifie ici.
vi.mock('recharts', () => {
  const Stub = ({ children }) => <div>{children}</div>
  return {
    BarChart: Stub, Bar: Stub, XAxis: Stub, YAxis: Stub,
    CartesianGrid: Stub, Tooltip: Stub, ResponsiveContainer: Stub,
  }
})

import AnalyticsChart from '@features/admin/components/shared/analytics-chart'

beforeEach(() => { mockGetAnalyticsData.mockReset() })

describe('AnalyticsChart — échec de chargement', () => {
  it('ne reste pas bloqué sur « Chargement… » quand la requête rejette', async () => {
    mockGetAnalyticsData.mockRejectedValue(new Error('network down'))

    render(<AnalyticsChart />)
    expect(screen.getByText(/Chargement/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByText(/Chargement/i)).not.toBeInTheDocument()
    })
  })

  it('annonce l\'échec plutôt que de laisser croire à une absence de données', async () => {
    mockGetAnalyticsData.mockRejectedValue(new Error('network down'))

    render(<AnalyticsChart />)

    // « Aucune donnée sur cette période » serait un mensonge : on ne sait pas
    // s'il y en a, on n'a pas réussi à lire.
    await waitFor(() => {
      expect(screen.getByText(/n'ont pas pu être chargées/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/Aucune donnée sur cette période/i)).not.toBeInTheDocument()
  })

  it('affiche les données quand la requête réussit', async () => {
    // ⚠️ Forme réelle de `adminGetAnalyticsData` depuis le lot 12l : `{ jours }`,
    // une ligne par jour rendue par `admin_activite_par_jour` (avant : trois
    // listes brutes). Un mock au mauvais format faisait planter l'agrégation
    // dans un `useMemo` — le test restait vert tout en levant une exception non
    // gérée, que seul le code de sortie de Vitest signalait.
    mockGetAnalyticsData.mockResolvedValue({ jours: [{ jour: '2026-10-09', actions: 2, inscriptions: 1, recettes: 0 }] })

    render(<AnalyticsChart />)

    await waitFor(() => {
      expect(screen.queryByText(/Chargement/i)).not.toBeInTheDocument()
    })
    expect(screen.queryByText(/n'ont pas pu être chargées/i)).not.toBeInTheDocument()
  })
})
