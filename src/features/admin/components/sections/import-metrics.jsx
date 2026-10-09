import { useState } from 'react'
import { LuRefreshCw, LuClock, LuCheck, LuX, LuTrendingUp, LuPackage, LuTriangleAlert } from 'react-icons/lu'
import { adminGetImportMetrics } from '@features/admin/api/admin'
import StatCard from '@features/admin/components/shared/stat-card'
import { useReloader } from '@shared/hooks/use-reloader'
import { leverSiErreur } from '@shared/lib/supabase/lever-si-erreur'
import ChargementRate from '../shared/chargement-rate'

export default function ImportMetrics({ darkMode = false, reloadKey = 0 }) {
  const [metrics, setMetrics] = useState(null)

  // `useReloader` garantit le `finally` (sans lui, une erreur réseau laissait
  // le voyant allumé pour toujours) et périme les réponses en retard : sans ça,
  // enchaîner deux rechargements laissait le plus ancien écraser le plus récent.
  // `reloadKey` reste la dépendance : c'est `import-queue-tab` qui l'incrémente
  // après chaque publication/rejet pour rafraîchir les métriques.
  const { loading, error, reload } = useReloader(async (estObsolete) => {
    const { metrics: m } = leverSiErreur(await adminGetImportMetrics())
    if (estObsolete()) return
    setMetrics(m)
  }, [reloadKey])

  const muted  = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'

  // Pas chargées : le dire, plutôt que des zéros qui se liraient « file vide » (audit ADM-08).
  if (error) return <ChargementRate error={error} onRetry={reload} />
  const m = metrics ?? { byStatus: {}, bySource: {}, topErrorCodes: [], eventsLast7d: {} }
  const totalInQueue = (m.byStatus.pending ?? 0) + (m.byStatus.valid ?? 0) + (m.byStatus.invalid ?? 0) + (m.byStatus.admin_review ?? 0)
  const withErrors   = (m.byStatus.invalid ?? 0) + (m.byStatus.admin_review ?? 0)
  const topSource    = Object.entries(m.bySource).sort((a, b) => b[1] - a[1])[0]
  const topError     = m.topErrorCodes[0]

  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 12,
      border: `1px solid ${border}`,
      background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          📊 Métriques import
        </span>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          aria-label="Recharger les métriques"
          style={{
            marginLeft: 'auto',
            background: 'transparent', border: 'none',
            padding: 4, cursor: 'pointer', color: muted,
          }}
        >
          <LuRefreshCw size={13} className={loading ? 'animate-spin' : undefined} />
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 10,
      }}>
        <StatCard
          icon={<LuPackage size={16} />}
          label="En queue"
          value={totalInQueue}
          accent="var(--color-brand-500)"
          loading={loading}
          darkMode={darkMode}
        />
        <StatCard
          icon={<LuCheck size={16} />}
          label="Prêt à publier"
          value={m.byStatus.valid ?? 0}
          accent="var(--color-success)"
          loading={loading}
          darkMode={darkMode}
        />
        <StatCard
          icon={<LuTriangleAlert size={16} />}
          label="Avec erreurs"
          value={withErrors}
          accent="var(--color-danger)"
          loading={loading}
          darkMode={darkMode}
        />
        <StatCard
          icon={<LuTrendingUp size={16} />}
          label="Publiées 7j"
          value={m.eventsLast7d.published ?? 0}
          accent="#5A8A58"
          loading={loading}
          darkMode={darkMode}
        />
        {topSource && (
          <StatCard
            icon={<LuClock size={16} />}
            label={`Source #1 : ${topSource[0]}`}
            value={topSource[1]}
            accent="#3A8895"
            loading={loading}
            darkMode={darkMode}
          />
        )}
        {topError && (
          <StatCard
            icon={<LuX size={16} />}
            label={`Erreur #1 : ${topError.code}`}
            value={topError.count}
            accent="var(--color-warning)"
            loading={loading}
            darkMode={darkMode}
          />
        )}
      </div>
    </div>
  )
}
