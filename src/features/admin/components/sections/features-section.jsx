import { useState } from 'react'
import { LuToggleLeft, LuToggleRight } from 'react-icons/lu'
import { loadFeatureFlags, setFeatureFlag } from '@shared/api/feature-flags'
import { useReloader } from '@shared/hooks/use-reloader'
import { leverSiErreur } from '@shared/lib/supabase/lever-si-erreur'
import { useFeedback } from '@features/admin/hooks/use-feedback'
import FeedbackBanner from '../shared/feedback-banner'
import ChargementRate from '../shared/chargement-rate'
import { messageErreurAdmin } from '@features/admin/lib/ecritures-admin'
import { useFeatureFlags } from '@shared/contexts/feature-flags-provider'
import Button from '@shared/ui/button'
import { useConfirm } from '@shared/ui/confirm-dialog/confirm-provider'

// Flags dont une vraie fonctionnalité consomme la clé quelque part dans le code
// (grep exhaustif sur useFeatureFlag('<key>')). Un flag absent de cette liste
// n'a aucun effet visible s'il est activé — le basculer serait trompeur pour
// l'admin. À mettre à jour dès qu'un flag "prévu" est réellement branché.
const IMPLEMENTED_FLAGS = new Set(['onboarding_activation', 'push_notifications', 'receipt_scan'])

const I18N = {
  fr: {
    intro: 'Active ou désactive une fonctionnalité en production, sans redéploiement.',
    empty: 'Aucune fonctionnalité configurée.',
    on: 'Activée', off: 'Désactivée',
    groupLive: 'En production',
    groupPlanned: 'Prévues — pas encore développées',
    plannedWarning: 'Aucun code ne lit ce flag pour l\'instant — l\'activer n\'aura aucun effet visible.',
    activer: 'Activer', desactiver: 'Désactiver',
    effet: 'Le changement est immédiat, pour tous les visiteurs.', cle: 'Clé :',
  },
}

export default function FeaturesSection({ lang = 'fr', darkMode = false }) {
  const t = I18N.fr
  const { reload } = useFeatureFlags()
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(null)
  const [feedback, showFeedback] = useFeedback()
  const confirm = useConfirm()

  // Pas lus : le dire, pas « Aucune fonctionnalité configurée » (audit ADM-08, ADM-09).
  const { error, reload: relire } = useReloader(async (estObsolete) => {
    const { data } = leverSiErreur(await loadFeatureFlags())
    if (!estObsolete()) setRows(data)
  }, [])

  const fg    = darkMode ? '#C8D8E8' : '#2C1A0E'
  const muted = darkMode ? '#7A90A8' : '#5C4033'
  const border = darkMode ? '#1E3048' : '#DDD0C0'

  // Basculer agit en production, tout de suite, pour tout le monde : nommer la
  // fonctionnalité et l'effet, attendre un oui (audit du 2026-10-04, ADM-04).
  // La base écrit ensuite la bascule au journal (`feature_flag_toggled`).
  async function toggle(row) {
    const next = !row.enabled
    const verbe = next ? t.activer : t.desactiver
    if (!(await confirm({
      title: `${verbe} « ${row.label} » ?`,
      body: `${t.effet} ${t.cle} ${row.key}.`,
      confirmLabel: verbe,
    }))) return
    setBusy(row.key)
    const { error: refus } = await setFeatureFlag(row.key, next)
    if (refus) showFeedback(false, messageErreurAdmin(refus, lang)) // l'interrupteur ne bouge pas : le dire
    else {
      setRows(rs => rs.map(r => r.key === row.key ? { ...r, enabled: next } : r))
      reload() // rafraîchit le contexte global pour que les hooks useFeatureFlag suivent
    }
    setBusy(null)
  }

  const liveRows = rows.filter(row => IMPLEMENTED_FLAGS.has(row.key))
  const plannedRows = rows.filter(row => !IMPLEMENTED_FLAGS.has(row.key))

  function renderRow(row) {
    const planned = !IMPLEMENTED_FLAGS.has(row.key)
    return (
      <div key={row.key} style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', border: `1px solid ${border}`, borderRadius: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: fg }}>{row.label}</div>
          {row.description && (
            <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{row.description}</div>
          )}
          <code style={{ fontSize: 11, color: muted, opacity: 0.7 }}>{row.key}</code>
          {planned && (
            <div style={{ fontSize: 11.5, color: 'var(--color-warning, #B25412)', marginTop: 4 }}>
              ⚠ {t.plannedWarning}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          onClick={() => toggle(row)}
          disabled={busy === row.key}
          aria-pressed={row.enabled}
          className="h-auto rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-transparent"
          style={{
            gap: 6,
            color: row.enabled ? 'var(--color-success)' : muted,
            border: `1px solid ${row.enabled ? 'var(--color-success)' : border}`,
          }}
        >
          {row.enabled ? <LuToggleRight size={16} /> : <LuToggleLeft size={16} />}
          {row.enabled ? t.on : t.off}
        </Button>
      </div>
    )
  }

  function renderGroup(title, groupRows) {
    if (groupRows.length === 0) return null
    return (
      <div key={title}>
        <p style={{
          margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: muted,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {title}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groupRows.map(renderRow)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: muted }}>{t.intro}</p>
      <FeedbackBanner feedback={feedback} />
      {error ? (
        <ChargementRate error={error} onRetry={relire} lang={lang} />
      ) : rows.length === 0 ? (
        <p style={{ fontSize: 13, color: muted }}>{t.empty}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {renderGroup(t.groupLive, liveRows)}
          {renderGroup(t.groupPlanned, plannedRows)}
        </div>
      )}
    </div>
  )
}
