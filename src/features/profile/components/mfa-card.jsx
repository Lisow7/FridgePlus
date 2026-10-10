import { useState } from 'react'
import { LuShieldCheck } from 'react-icons/lu'
import { useMFA } from '@shared/hooks/use-mfa'
import { MFA_I18N } from '@shared/lib/i18n/mfa-i18n'
import MFAEnrollModal from '@shared/ui/mfa-enroll-modal'
import MFAChallengeModal from '@shared/ui/mfa-challenge-modal'
import Button from '@shared/ui/button'
import { useConfirm } from '@shared/ui/confirm-dialog/confirm-provider'

// Phase 7 launch (refonte Profil) — sous-composant extrait de
// ProfileModal lors de la PR 8.6.1.b. Encapsule l'état d'enroll/unenroll
// MFA TOTP (côté Profil → Sécurité). Pas de changement comportemental.
//
// Affiche : badge actif/inactif, bouton activer (ouvre MFAEnrollModal),
// liste des facteurs actifs avec bouton désactiver.

export default function MfaCard({ lang, darkMode, isMobile, border, textColor, mutedColor }) {
  const t = MFA_I18N[lang] ?? MFA_I18N.fr
  const confirm = useConfirm()
  const { factors, hasVerifiedFactor, isAAL2, pret, startEnroll, unenroll, refresh } = useMFA()
  // factor pré-créé avec QR + secret. La modale ne fait QUE l'afficher
  // et déclencher verify. Plus de useEffect d'enroll dans la modale →
  // pas d'effet StrictMode double-mount qui annule des enrolls.
  const [enrollData, setEnrollData] = useState(null)
  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState(null)

  async function handleActivate() {
    if (activating) return
    setActivating(true)
    setActivateError(null)

    // 1. Cleanup des facteurs orphelins (status unverified ou type non-totp)
    try {
      const { listMFAFactors, unenrollFactor } = await import('@shared/api/mfa')
      const list = await listMFAFactors()
      for (const f of list.all ?? []) {
        if (f.status === 'unverified' || f.factor_type !== 'totp') {
          await unenrollFactor(f.id).catch(() => {})
        }
      }
    } catch { /* best-effort cleanup */ }

    // 2. Démarrer l'enroll
    const result = await startEnroll('Fridge+ TOTP')
    setActivating(false)
    if (result.error) {
      setActivateError(result.error.message ?? String(result.error))
      return
    }
    setEnrollData(result)
  }

  // Pour désactiver un facteur verified, Supabase exige une session AAL2.
  // Si on est en AAL1, on ouvre d'abord MFAChallengeModal pour s'élever,
  // puis on tente l'unenroll. Si déjà AAL2 → unenroll direct.
  const [pendingUnenrollId, setPendingUnenrollId] = useState(null)
  const [showChallenge,     setShowChallenge]     = useState(false)
  const [unenrollError,     setUnenrollError]     = useState(null)

  async function handleDeactivate(factorId) {
    if (!(await confirm({ title: t.deactivateConfirm, danger: true }))) return
    setUnenrollError(null)
    if (!isAAL2) {
      setPendingUnenrollId(factorId)
      setShowChallenge(true)
      return
    }
    await doUnenroll(factorId)
  }

  async function doUnenroll(factorId) {
    const { error } = await unenroll(factorId)
    if (error) setUnenrollError(error.message ?? String(error))
  }

  function handleChallengeOk() {
    const id = pendingUnenrollId
    setShowChallenge(false)
    setPendingUnenrollId(null)
    if (id) doUnenroll(id)
  }

  return (
    <div style={{
      marginTop: isMobile ? '12px' : '16px',
      paddingTop: isMobile ? '14px' : '18px',
      borderTop: `1px solid ${border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {/* Tant que les facteurs ne sont pas lus, la carte ne dit ni « Active »
            ni « Inactive » (audit du 2026-10-04, comptes et authentification). */}
        <LuShieldCheck size={16} color={!pret ? mutedColor : hasVerifiedFactor ? 'var(--color-success)' : 'var(--color-warm-500)'} />
        <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: 700, color: textColor, margin: 0, flex: 1 }}>
          {t.profileSection}
        </p>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
          background: !pret ? 'transparent' : hasVerifiedFactor ? 'rgba(34,197,94,0.15)' : 'rgba(247,168,94,0.15)',
          color: !pret ? mutedColor : hasVerifiedFactor ? 'var(--color-success)' : 'var(--color-warm-text)',
        }}>
          {!pret ? t.checkingBadge : hasVerifiedFactor ? t.activeBadge : t.inactiveBadge}
        </span>
      </div>

      <p style={{ fontSize: isMobile ? '12px' : '13px', color: mutedColor, lineHeight: 1.5, margin: '0 0 12px' }}>
        {t.profileIntro}
      </p>

      {!pret ? null : !hasVerifiedFactor ? (
        <>
          <Button
            onClick={handleActivate}
            loading={activating}
            disabled={activating}
            className="h-auto rounded-lg bg-[#B85000] px-4 py-2.5 text-[13px] font-bold text-white"
            style={{ gap: 6 }}
          >
            {!activating && <LuShieldCheck size={14} />}
            {activating ? t.enrolling : t.activateBtn}
          </Button>
          {activateError && (
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--color-danger)', fontFamily: 'monospace', wordBreak: 'break-word' }}>
              ⚠️ {activateError}
            </p>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {factors.map(f => (
            <div key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 8,
              border: `1px solid ${border}`,
              background: darkMode ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.05)',
            }}>
              <LuShieldCheck size={14} color="var(--color-success)" />
              <span style={{ flex: 1, fontSize: 13, color: textColor }}>
                {f.friendly_name || 'TOTP'}
              </span>
              <Button
                variant="ghost"
                onClick={() => handleDeactivate(f.id)}
                className="h-auto rounded-none bg-transparent p-0 text-xs font-semibold hover:bg-transparent"
                style={{ color: 'var(--color-danger)' }}
              >
                {t.deactivateBtn}
              </Button>
            </div>
          ))}
        </div>
      )}

      {enrollData && (
        <MFAEnrollModal
          factor={enrollData}
          lang={lang}
          darkMode={darkMode}
          onClose={() => setEnrollData(null)}
          onEnrolled={() => { setEnrollData(null); refresh() }}
        />
      )}

      {showChallenge && (
        <MFAChallengeModal
          reason={t.challengeReason}
          lang={lang}
          darkMode={darkMode}
          onClose={() => { setShowChallenge(false); setPendingUnenrollId(null) }}
          onChallenged={handleChallengeOk}
        />
      )}

      {unenrollError && (
        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--color-danger)', fontFamily: 'monospace', wordBreak: 'break-word' }}>
          ⚠️ {unenrollError}
        </p>
      )}
    </div>
  )
}
