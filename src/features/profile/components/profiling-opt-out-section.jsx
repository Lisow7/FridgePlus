import { useState } from 'react'
import { LuShieldOff } from 'react-icons/lu'

// Section « Opposition au profilage » — Sprint 10 S10.c.3.
// Implémente RGPD Article 21 (droit d'opposition) côté UI.
//
// L'opt-in (false par défaut) reflète le traitement légitime des données
// pour l'analyse de dépenses Premium. Activer le toggle = opt-out :
// `recordSpendingEvent` doit skip silencieusement (gating S10.c.4).
//
// Pure presentational : reçoit value + setter du parent (ProfileModal),
// qui appelle `updateProfile({ profiling_opted_out: ... })` via le
// AuthProvider.

const I18N = {
  fr: {
    title: 'Opposition au profilage',
    description: 'Tu peux t\'opposer à l\'analyse automatisée de ton historique de dépenses (Article 21 RGPD). Si tu actives ce paramètre, Fridge+ arrêtera de capturer un instantané de chaque transfert panier → frigo. Le graphique « Analyse des dépenses » ne se mettra plus à jour. Les données déjà capturées ne sont pas effacées automatiquement — utilise « Supprimer mon historique de dépenses » pour cela (à venir).',
    toggleLabel: 'M\'opposer au profilage',
    optedInBadge: 'Capture active',
    optedOutBadge: 'Opposé au profilage',
    savingLabel: 'Enregistrement…',
    errorLabel: 'Échec de l\'enregistrement. Réessaie.',
  },
  en: {
    title: 'Object to profiling',
    description: 'You can object to automated analysis of your spending history (GDPR Article 21). Enabling this setting stops Fridge+ from snapshotting each cart → fridge transfer. The "Spending analysis" chart will no longer update. Already-captured data is not erased automatically — use "Erase my spending history" for that (coming soon).',
    toggleLabel: 'Object to profiling',
    optedInBadge: 'Capture active',
    optedOutBadge: 'Profiling objected',
    savingLabel: 'Saving…',
    errorLabel: 'Save failed. Retry.',
  },
}

export default function ProfilingOptOutSection({
  optedOut,
  onChange,           // (nextValue: boolean) => Promise<{ error: any }>
  lang,
  isMobile,
  darkMode,
  border,
  textColor,
  mutedColor,
}) {
  const t = I18N[lang] ?? I18N.fr
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  const handleToggle = async () => {
    if (saving) return
    setSaving(true)
    setError(false)
    const result = await onChange(!optedOut)
    if (result?.error) setError(true)
    setSaving(false)
  }

  const accent = optedOut ? '#5BA055' : '#D46A10'
  const badgeBg = optedOut
    ? (darkMode ? 'rgba(91,160,85,0.16)' : 'rgba(91,160,85,0.12)')
    : (darkMode ? 'rgba(212,106,16,0.16)' : 'rgba(212,106,16,0.12)')

  return (
    <section style={{
      padding: isMobile ? '14px' : '16px',
      borderRadius: '12px',
      border: `1px solid ${border}`,
      background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.40)',
      display: 'flex', flexDirection: 'column', gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: 'var(--gradient-deep)',
          color: '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <LuShieldOff size={15} />
        </span>
        {/* <h3> : sous le <h2> de la section « Confidentialité » (axe
            `heading-order` — audit du 2026-10-04, PREM-11). */}
        <h3 style={{
          margin: 0, fontSize: isMobile ? '14px' : '15px',
          fontWeight: 800, color: textColor, flex: 1, minWidth: 0,
        }}>
          {t.title}
        </h3>
        <span style={{
          fontSize: '11px', fontWeight: 700,
          padding: '3px 9px', borderRadius: '6px',
          background: badgeBg, color: accent, whiteSpace: 'nowrap',
        }}>
          {optedOut ? t.optedOutBadge : t.optedInBadge}
        </span>
      </div>

      <p style={{
        fontSize: isMobile ? '12px' : '13px',
        color: mutedColor, margin: 0, lineHeight: 1.55,
      }}>
        {t.description}
      </p>

      <label style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 12px', borderRadius: '8px',
        background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.55)',
        border: `1px solid ${border}`,
        cursor: saving ? 'wait' : 'pointer',
        opacity: saving ? 0.7 : 1,
        transition: 'opacity 0.15s',
      }}>
        <input
          type="checkbox"
          checked={optedOut}
          onChange={handleToggle}
          disabled={saving}
          style={{
            width: '18px', height: '18px',
            accentColor: accent,
            cursor: saving ? 'wait' : 'pointer',
            flexShrink: 0,
          }}
        />
        <span style={{
          fontSize: isMobile ? '13px' : '14px',
          fontWeight: 600, color: textColor,
        }}>
          {t.toggleLabel}
        </span>
        {saving && (
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: mutedColor }}>
            {t.savingLabel}
          </span>
        )}
      </label>

      {error && (
        <p style={{
          margin: 0, fontSize: '12px', color: '#ef4444', fontWeight: 600,
        }}>
          {t.errorLabel}
        </p>
      )}
    </section>
  )
}
