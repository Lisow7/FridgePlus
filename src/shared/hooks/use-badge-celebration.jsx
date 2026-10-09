import { useCallback } from 'react'
import { useToast } from '@shared/ui/toast/toast-provider'
import { loadAllCookingLogs } from '@shared/api/cooking-logs'
import { computeBadges, unlockedIds, BADGE_DEFINITIONS } from '@shared/lib/recipes/achievements'
import { seedIfAbsent } from '@shared/lib/recipes/badges-seen'

const BY_ID = Object.fromEntries(BADGE_DEFINITIONS.map((d) => [d.id, d]))

const I18N = {
  fr: { title: 'Badge débloqué !' },
  en: { title: 'Badge unlocked!' },
}

// Toast de célébration (ReactNode fourni au ToastProvider). Dégradé de marque
// via le token --gradient-warm (single-source).
function BadgeToast({ emoji, label, lang }) {
  const title = (I18N[lang] ?? I18N.fr).title
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '12px 16px', borderRadius: '12px',
      background: '#B85000',
      color: '#fff', boxShadow: '0 6px 20px rgba(224,120,32,0.35)', maxWidth: '320px',
    }}>
      <span aria-hidden="true" style={{ fontSize: '24px', lineHeight: 1 }}>{emoji}</span>
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <strong style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {title}
        </strong>
        <span style={{ fontSize: '13px' }}>{label}</span>
      </span>
    </div>
  )
}

/**
 * Hook de célébration de badges. Renvoie une fonction à appeler **après un log
 * de cuisine réussi** : refetch les logs, calcule les badges, diffe contre le
 * snapshot local, émet un toast par badge nouvellement débloqué. Anti-flood :
 * seed silencieux au 1er appel. La célébration ne casse jamais le flux (try/catch).
 *
 * @returns {(userId: string, opts?: { resolveCountry?: Function, lang?: string }) => Promise<void>}
 */
export function useBadgeCelebration() {
  const { show } = useToast()
  return useCallback(async (userId, { resolveCountry, lang = 'fr' } = {}) => {
    if (!userId) return
    try {
      // Journal pas chargé : ne rien conclure. Une liste vide « sèmerait » zéro
      // badge, et le chargement suivant fêterait d'un coup tous ceux déjà acquis.
      const { logs, error } = await loadAllCookingLogs(userId)
      if (error) return
      const ids = unlockedIds(computeBadges(logs ?? [], resolveCountry))
      const { seeded, toCelebrate } = seedIfAbsent(ids)
      if (seeded) return
      for (const id of toCelebrate) {
        const def = BY_ID[id]
        if (!def) continue
        show(
          <BadgeToast emoji={def.emoji} label={def.label[lang] ?? def.label.fr} lang={lang} />,
          { id: `badge-${id}`, duration: 6000 },
        )
      }
    } catch {
      /* la célébration ne doit jamais casser le flux de log */
    }
  }, [show])
}
