import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { LuStar, LuMail, LuCookie, LuDownload, LuCheck, LuEye, LuEyeOff, LuKeyRound } from 'react-icons/lu'
import { useAuth } from '@shared/contexts/auth-provider'
import { useSubscription } from '@shared/hooks/use-subscription'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import Button from '@shared/ui/button'
import { exportUserData, triggerJsonDownload } from '@features/profile/api/data-export'
import { eraseSpendingHistory } from '@shared/api/spending'
// eslint-disable-next-line import/no-restricted-paths -- audit.js service partagé (Sprint 9 décision)
import { logAuditAction, AUDIT_ACTIONS } from '@features/admin/lib/audit'
// eslint-disable-next-line import/no-restricted-paths -- legal RGPD intégré au profil
import { ConfidentialityPanel } from '@features/legal'
import MfaCard from '@features/profile/components/mfa-card'
import DangerZone from '@features/profile/components/danger-zone'
import ProfilingOptOutSection from '@features/profile/components/profiling-opt-out-section'
import EraseSpendingHistorySection from '@features/profile/components/erase-spending-history-section'
import SubscriptionTab from '@features/profile/components/subscription-tab'
import ProfilePageIntro from '@features/profile/components/profile-page-intro'
import ProfileSection  from '@features/profile/components/profile-section'

// Sprint 11 S11.a.5 — sous-page /profile/compte.
// Compte & sécurité : Abonnement Premium en premier (mise en avant),
// Identifiants (email + password reset + MFA), Confidentialité & cookies,
// Mes données (export RGPD + effacer historique dépenses), Zone de danger.
//
// Audit log RGPD :
//   - PROFILE_DATA_VIEWED  : déclenché au mount (visualisation de la page)
//   - PROFILE_DATA_EXPORTED : déclenché à chaque export JSON

const I18N = {
  fr: {
    pageTitle: 'Compte & sécurité',
    pageIntro: 'Gère ton abonnement, ton compte et tes données.',
    subTitle:    'Abonnement Premium',
    subDesc:     'Ton plan et la gestion Stripe.',
    idTitle:     'Identifiants',
    idDesc:      'E-mail, mot de passe et 2FA.',
    idEmailLabel: 'E-mail',
    idEmailReveal: 'Afficher',
    idEmailMask:   'Masquer',
    idEmailHidden: 'Masqué pour ta protection.',
    idResetBtn:   'Changer mon mot de passe',
    idResetSent:  '✓ E-mail envoyé. Vérifie ta boîte de réception.',
    idResetError: 'Impossible d\'envoyer l\'e-mail. Réessaie plus tard.',
    privTitle:    'Confidentialité & cookies',
    privDesc:     'Tes choix de cookies, et ton droit de refuser le profilage.',
    dataTitle:    'Télécharger mes données',
    dataDesc:     'Un fichier avec tout ce que contient ton compte.',
    exportText:   'Profil, frigo, recettes, favoris, panier, restes, journal de cuisine, dépenses, messages et avis de la communauté, notifications, tickets.',
    exportBtn:    'Télécharger',
    exportLoad:   'Préparation…',
    exportOk:     'Téléchargement démarré.',
    exportErr:    'Export incomplet : rien n\'a été téléchargé. Réessaie.',
    dangerTitle:  'Zone de danger',
    dangerDesc:   'Supprimer ton compte.',
    dangerText:   'Tes données sont conservées 30 jours. Tu peux annuler la suppression à tout moment en te reconnectant. Passé ce délai, tout est effacé définitivement.',
    dangerConfirm: 'Mot de passe actuel (confirmation)',
    dangerBtn:    'Supprimer mon compte',
    tabDanger:    'Zone de danger',
    cancelBtn:    'Annuler',
    errorWrongPwd: 'Mot de passe incorrect.',
    errorGeneric:  'Une erreur est survenue.',
  },
  en: {
    pageTitle: 'Account & security',
    pageIntro: 'Manage your subscription, account and data.',
    subTitle:    'Premium subscription',
    subDesc:     'Your plan and Stripe management.',
    idTitle:     'Credentials',
    idDesc:      'E-mail, password and 2FA.',
    idEmailLabel: 'E-mail',
    idEmailReveal: 'Reveal',
    idEmailMask:   'Hide',
    idEmailHidden: 'Hidden for your protection.',
    idResetBtn:   'Change my password',
    idResetSent:  '✓ E-mail sent. Check your inbox.',
    idResetError: 'Could not send e-mail. Try again later.',
    privTitle:    'Privacy & cookies',
    privDesc:     'Your cookie choices, and your right to refuse profiling.',
    dataTitle:    'Download my data',
    dataDesc:     'One file with everything your account holds.',
    exportText:   'Profile, fridge, recipes, favourites, cart, leftovers, cooking log, spending, community posts and reviews, notifications, tickets.',
    exportBtn:    'Download',
    exportLoad:   'Preparing…',
    exportOk:     'Download started.',
    exportErr:    'Incomplete export: nothing was downloaded. Try again.',
    dangerTitle:  'Danger zone',
    dangerDesc:   'Delete your account.',
    dangerText:   'Your data is kept for 30 days. You can cancel the deletion any time by signing back in. After that, everything is permanently erased.',
    dangerConfirm: 'Current password (confirmation)',
    dangerBtn:    'Delete my account',
    tabDanger:    'Danger zone',
    cancelBtn:    'Cancel',
    errorWrongPwd: 'Current password incorrect.',
    errorGeneric:  'An error occurred.',
  },
}

const PWD_TOGGLE_LABEL = {
  fr: { show: 'Afficher le mot de passe', hide: 'Masquer le mot de passe' },
  en: { show: 'Show password',            hide: 'Hide password'           },
}
const pwdToggleLabel = (lang, isShown) => (PWD_TOGGLE_LABEL[lang] ?? PWD_TOGGLE_LABEL.fr)[isShown ? 'hide' : 'show']

// Masque partiellement une adresse e-mail (RGPD : minimisation à l'écran).
// Garde la 1re et dernière lettre du local-part + le TLD complet.
//   alice.dupont@example.com → a••••••••••t@e******.com
//   ab@x.io                  → a•@x.io
function maskEmail(email) {
  if (!email || typeof email !== 'string') return ''
  const at = email.indexOf('@')
  if (at < 1) return email
  const local  = email.slice(0, at)
  const domain = email.slice(at + 1)
  const maskedLocal = local.length <= 1
    ? local
    : local[0] + '•'.repeat(Math.max(1, local.length - 2)) + local.slice(-1)
  const lastDot = domain.lastIndexOf('.')
  if (lastDot < 0) return `${maskedLocal}@${domain}`
  const main = domain.slice(0, lastDot)
  const tld  = domain.slice(lastDot)
  const maskedMain = main.length <= 1 ? main : main[0] + '*'.repeat(Math.max(1, main.length - 1))
  return `${maskedLocal}@${maskedMain}${tld}`
}

export default function ProfileAccountPage() {
  const { lang = 'fr', darkMode = false, user, profile, isAdmin } = useOutletContext()
  const t = I18N[lang] ?? I18N.fr
  const { requestPasswordResetEmail, updateProfile, signInWithEmail, deleteAccount } = useAuth()
  const { hasPremiumAccess, isSpecialAccess } = useSubscription()
  const windowWidth = useWindowWidth()
  const isMobile = windowWidth < 640

  const textColor  = darkMode ? '#EBE4D8' : '#2d1b00'
  const mutedColor = darkMode ? '#7A90A8' : '#6A4F45'
  const border     = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  // Texte d'une alerte sur son fond rosé. Le rouge `#DC2626` n'y tenait pas le
  // contraste AA (3,9 en clair, 3,5 en sombre, pour 4,5 exigés) ; ces deux-là
  // le tiennent (5,2 et 8,8).
  const alertColor = darkMode ? '#FCA5A5' : '#B91C1C'
  const modalBg    = darkMode ? '#0F1622' : '#FDFAF6'
  const inputBg    = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.60)'
  const iconStyle  = { color: mutedColor, flexShrink: 0 }
  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: `1.5px solid ${border}`, background: inputBg, color: textColor,
    fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }

  // ── Audit log : vue de la page (RGPD) ────────────────────────────────
  useEffect(() => {
    if (user?.id) {
      logAuditAction(AUDIT_ACTIONS.PROFILE_DATA_VIEWED, { metadata: { lang } })
    }
  }, [user?.id, lang])

  // ── E-mail masqué par défaut (RGPD), révélé 5 s au clic ─────────────
  const [emailRevealed, setEmailRevealed] = useState(false)
  useEffect(() => {
    if (!emailRevealed) return
    const timer = setTimeout(() => setEmailRevealed(false), 5000)
    return () => clearTimeout(timer)
  }, [emailRevealed])

  // ── Reset password par e-mail ────────────────────────────────────────
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  async function handleSendReset() {
    if (!user?.email) return
    setResetLoading(true)
    setResetError(false)
    setResetSent(false)
    const result = await requestPasswordResetEmail(user.email)
    setResetLoading(false)
    if (result?.error) setResetError(true)
    else setResetSent(true)
  }

  // ── Export RGPD Art. 15 ──────────────────────────────────────────────
  const [exportStatus, setExportStatus] = useState('idle')

  async function handleExport() {
    if (!user?.id) return
    setExportStatus('loading')
    try {
      const result = await exportUserData(user.id)
      if (result?.ok) {
        const sizeKb = Math.round(((result.size ?? 0) / 1024))
        await logAuditAction(AUDIT_ACTIONS.PROFILE_DATA_EXPORTED, { metadata: { lang, size_kb: sizeKb } })
        triggerJsonDownload(result.data, `fridge-data-${Date.now()}`)
        setExportStatus('success')
        setTimeout(() => setExportStatus('idle'), 3000)
      } else {
        setExportStatus('error')
      }
    } catch {
      setExportStatus('error')
    }
  }

  // ── DangerZone state local ───────────────────────────────────────────
  const [dangerDialogOpen, setDangerDialogOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [showDeletePwd, setShowDeletePwd] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  async function handleDeleteAccount(e) {
    e.preventDefault()
    setDeleteLoading(true)
    setDeleteError(null)
    const { error: loginErr } = await signInWithEmail(user.email, deletePassword, false)
    if (loginErr) {
      setDeleteError(t.errorWrongPwd)
      setDeleteLoading(false)
      return
    }
    const { error } = await deleteAccount(lang)
    if (error) setDeleteError(t.errorGeneric)
    setDeleteLoading(false)
  }

  // i18n object pour DangerZone (sous-composant attend `t` shape)
  const dangerT = {
    dangerTitle:   t.dangerTitle,
    dangerText:    t.dangerText,
    dangerBtn:     t.dangerBtn,
    dangerConfirm: t.dangerConfirm,
    cancelBtn:     t.cancelBtn,
    tabDanger:     t.tabDanger,
  }

  return (
    <>
      <ProfilePageIntro title={t.pageTitle} description={t.pageIntro} darkMode={darkMode} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* ─── 1. Abonnement Premium (en premier, mise en avant) ─────── */}
        <ProfileSection
          Icon={LuStar}
          title={t.subTitle}
          description={t.subDesc}
          badge={isAdmin || isSpecialAccess ? undefined : 'premium'}
          lang={lang}
          darkMode={darkMode}
        >
          <SubscriptionTab lang={lang} darkMode={darkMode} />
        </ProfileSection>

        {/* ─── 2. Identifiants ──────────────────────────────────────── */}
        <ProfileSection
          Icon={LuMail}
          title={t.idTitle}
          description={t.idDesc}
          badge="sensitive"
          lang={lang}
          darkMode={darkMode}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '13px', color: mutedColor }}>
              <strong style={{ color: textColor }}>{t.idEmailLabel} :</strong>
              <span style={{ wordBreak: 'break-all', fontVariantNumeric: 'tabular-nums' }}>
                {emailRevealed ? user?.email : maskEmail(user?.email ?? '')}
              </span>
              <button
                type="button"
                onClick={() => setEmailRevealed((v) => !v)}
                aria-label={emailRevealed ? t.idEmailMask : t.idEmailReveal}
                title={emailRevealed ? t.idEmailMask : t.idEmailReveal}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '4px 8px', borderRadius: '6px',
                  border: `1px solid ${border}`, background: 'transparent',
                  color: mutedColor, fontSize: '11px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {emailRevealed ? <LuEyeOff size={12} /> : <LuEye size={12} />}
                {emailRevealed ? t.idEmailMask : t.idEmailReveal}
              </button>
            </div>
            {!emailRevealed && (
              <p style={{ fontSize: '11px', color: mutedColor, margin: 0, fontStyle: 'italic' }}>
                {t.idEmailHidden}
              </p>
            )}
            <Button
              onClick={handleSendReset}
              loading={resetLoading}
              disabled={resetLoading}
              className="h-auto self-start rounded-lg bg-[#B85000] px-4 py-2.5 text-[13px] font-bold text-white"
              style={{ gap: 6 }}
            >
              {!resetLoading && <LuKeyRound size={14} />}
              {t.idResetBtn}
            </Button>
            {resetSent && (
              <p style={{
                fontSize: '12px', color: '#16A34A', margin: 0,
                padding: '8px 10px', borderRadius: '8px',
                background: darkMode ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.08)',
              }}>
                {t.idResetSent}
              </p>
            )}
            {resetError && (
              <p role="alert" style={{
                fontSize: '12px', color: alertColor, margin: 0,
                padding: '8px 10px', borderRadius: '8px',
                background: darkMode ? 'rgba(220,38,38,0.06)' : 'rgba(220,38,38,0.08)',
              }}>
                {t.idResetError}
              </p>
            )}
            <MfaCard
              lang={lang}
              darkMode={darkMode}
              isMobile={isMobile}
              border={border}
              textColor={textColor}
              mutedColor={mutedColor}
            />
          </div>
        </ProfileSection>

        {/* ─── 3. Confidentialité & cookies (replié par défaut) ─────── */}
        <ProfileSection
          Icon={LuCookie}
          title={t.privTitle}
          description={t.privDesc}
          badge="rgpd"
          lang={lang}
          darkMode={darkMode}
          collapsible
          defaultOpen={false}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <ConfidentialityPanel lang={lang} darkMode={darkMode} />
            {/* Sprint 11 — Opt-out profilage Premium-gated : la collecte
                des spending events n'a lieu que pour les Premium, donc
                cette option n'a aucun effet pour les comptes free. */}
            {hasPremiumAccess && (
              <ProfilingOptOutSection
                optedOut={!!profile?.profiling_opted_out}
                onChange={(next) => updateProfile({ profiling_opted_out: next })}
                lang={lang}
                isMobile={isMobile}
                darkMode={darkMode}
                border={border}
                textColor={textColor}
                mutedColor={mutedColor}
              />
            )}
          </div>
        </ProfileSection>

        {/* ─── 4. Mes données — export JSON (replié par défaut) ─────── */}
        <ProfileSection
          Icon={LuDownload}
          title={t.dataTitle}
          description={t.dataDesc}
          badge="rgpd"
          lang={lang}
          darkMode={darkMode}
          collapsible
          defaultOpen={false}
        >
          <div>
            <p style={{ fontSize: '13px', color: mutedColor, margin: '0 0 10px', lineHeight: 1.55 }}>{t.exportText}</p>
            <Button onClick={handleExport} loading={exportStatus === 'loading'} disabled={exportStatus === 'loading'}>
              {/* Icône retirée : déjà présente dans le header de la section
                  (pas de répétition visuelle). LuCheck conservé en cas
                  de succès car c'est un état distinct du header. */}
              {exportStatus === 'success' && <LuCheck size={14} />}
              {exportStatus === 'loading' ? t.exportLoad
                : exportStatus === 'success' ? t.exportOk
                : t.exportBtn}
            </Button>
            {/* L'échec se lit À CÔTÉ du bouton, pas dedans : la phrase n'y
                tient pas sur un téléphone, et un libellé qui change n'est pas
                annoncé. Le bouton reste « Télécharger » : on peut réessayer. */}
            {exportStatus === 'error' && (
              <p role="alert" style={{
                fontSize: '12px', color: alertColor, margin: '10px 0 0',
                padding: '8px 10px', borderRadius: '8px',
                background: darkMode ? 'rgba(220,38,38,0.06)' : 'rgba(220,38,38,0.08)',
              }}>
                {t.exportErr}
              </p>
            )}
          </div>
        </ProfileSection>

        {/* ─── 5. Effacer historique dépenses (Premium uniquement) ──── */}
        {/* Sprint 11 — masqué pour free : sans Premium, aucun spending
            event collecté → rien à effacer. */}
        {hasPremiumAccess && (
          <EraseSpendingHistorySection
            userId={user?.id}
            onErase={() => eraseSpendingHistory(user?.id)}
            lang={lang}
            isMobile={isMobile}
            darkMode={darkMode}
            border={border}
            textColor={textColor}
            mutedColor={mutedColor}
            modalBg={modalBg}
            collapsible
            defaultOpen={false}
          />
        )}

        {/* ─── 6. Zone de danger (replié par défaut, action critique) ──
            L'erreur s'affiche DANS la fenêtre (CPT-04 : elle s'écrivait ici,
            sous le fond flouté). */}
        <DangerZone
          isDialogOpen={dangerDialogOpen}
          onOpenDialog={() => { setDangerDialogOpen(true); setDeleteError(null); setDeletePassword('') }}
          onCloseDialog={() => setDangerDialogOpen(false)}
          password={deletePassword}
          onPasswordChange={setDeletePassword}
          showPassword={showDeletePwd}
          onTogglePasswordVisibility={() => setShowDeletePwd((v) => !v)}
          isLoading={deleteLoading}
          onSubmit={handleDeleteAccount}
          error={deleteError}
          t={dangerT}
          lang={lang}
          isMobile={isMobile}
          darkMode={darkMode}
          border={border}
          textColor={textColor}
          mutedColor={mutedColor}
          modalBg={modalBg}
          iconStyle={iconStyle}
          inputStyle={inputStyle}
          pwdToggleLabel={pwdToggleLabel}
          collapsible
          defaultOpen={false}
        />
      </div>
    </>
  )
}
