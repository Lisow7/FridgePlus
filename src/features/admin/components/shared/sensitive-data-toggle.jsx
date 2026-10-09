import { useState } from 'react'
import { LuEye, LuEyeOff, LuLock, LuShieldAlert } from 'react-icons/lu'
import ReusableModal from '@shared/ui/reusable-modal'
import ReasonSelector, { isReasonValid, formatReason } from './reason-selector'
import { logSensitiveDataAccess } from '@features/admin/api/sensitive-audit'
import Button from '@shared/ui/button'

// Composant qui cache une donnée sensible derrière un bouton.
// Au clic, ouvre une modale qui demande à l'admin :
//   1. Une raison normalisée (ReasonSelector — catégorie sensitive-data)
//   2. Optionnellement des détails libres
// Au confirme, logge l'accès dans activity_logs (RGPD : minimisation
// + traçabilité), puis révèle les enfants.
//
// Utilisation :
//   <SensitiveDataToggle
//     resourceType="user"
//     resourceId={userId}
//     fieldName="email"
//     lang={lang}
//     darkMode={darkMode}
//   >
//     <span>{user.email}</span>
//   </SensitiveDataToggle>

const I18N = {
  fr: {
    hidden:       'Masqué',
    revealBtn:    'Afficher',
    hideBtn:      'Masquer',
    modalTitle:   "Accès à une donnée sensible",
    modalIntro:   "Cette action sera enregistrée dans le journal d'audit avec la raison que tu indiques. Conformément au RGPD, l'accès aux données personnelles doit être justifié.",
    cancel:       'Annuler',
    confirm:      'Afficher',
    submitting:   'Enregistrement…',
    accessed:     'Accédé',
  },
  en: {
    hidden:       'Hidden',
    revealBtn:    'Reveal',
    hideBtn:      'Hide',
    modalTitle:   'Sensitive data access',
    modalIntro:   "This action will be logged in the audit journal with the reason you provide. As per GDPR, access to personal data must be justified.",
    cancel:       'Cancel',
    confirm:      'Reveal',
    submitting:   'Saving…',
    accessed:     'Accessed',
  },
}

export default function SensitiveDataToggle({
  resourceType,
  resourceId,
  fieldName,
  children,
  lang = 'fr',
  darkMode = false,
}) {
  const t = I18N[lang] ?? I18N.fr
  const [revealed,   setRevealed]   = useState(false)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [reason,     setReason]     = useState('')
  const [details,    setDetails]    = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? '#A0A8B8' : '#7A6A52'
  const accent = '#9C3B1F'

  function handleOpen() {
    setReason('')
    setDetails('')
    setModalOpen(true)
  }

  async function handleConfirm() {
    if (!isReasonValid({ value: reason, details, required: true })) return
    setSubmitting(true)
    const formatted = formatReason({ value: reason, details, lang })
    await logSensitiveDataAccess({
      resourceType,
      resourceId,
      fieldName,
      reason: formatted,
    })
    setSubmitting(false)
    setRevealed(true)
    setModalOpen(false)
  }

  if (revealed) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {children}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setRevealed(false)}
          aria-label={t.hideBtn}
          aria-pressed
          title={t.hideBtn}
          className="inline-flex h-auto w-auto bg-transparent p-0.5 hover:bg-transparent"
          style={{ color: muted }}
        >
          <LuEyeOff size={13} />
        </Button>
      </span>
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        onClick={handleOpen}
        aria-pressed={false}
        className="inline-flex h-auto rounded-[14px] border px-2.5 py-0.5 text-xs font-semibold hover:bg-transparent"
        style={{
          gap: 6,
          background: `${accent}11`,
          color: accent,
          borderColor: `${accent}33`,
        }}
      >
        <LuLock size={11} />
        {t.hidden}
        <LuEye size={12} />
      </Button>

      {modalOpen && (
        <ReusableModal
          open
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <LuShieldAlert size={18} color={accent} />
              {t.modalTitle}
            </span>
          }
          onClose={submitting ? undefined : () => setModalOpen(false)}
          darkMode={darkMode}
          size="md"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="h-auto rounded-lg border bg-transparent px-4 py-2.5 text-[13px] font-semibold"
                style={{
                  borderColor: darkMode ? 'var(--color-dark-border)' : '#D4C8B5',
                  color: fg,
                }}
              >
                {t.cancel}
              </Button>
              <Button
                onClick={handleConfirm}
                loading={submitting}
                disabled={submitting || !isReasonValid({ value: reason, details, required: true })}
                className="h-auto rounded-lg px-4 py-2.5 text-[13px] font-bold text-white"
                style={{ gap: 6, background: accent }}
              >
                {!submitting && <LuEye size={13} />}
                {submitting ? t.submitting : t.confirm}
              </Button>
            </>
          }
        >
          <p style={{ fontSize: 13, lineHeight: 1.55, color: muted, marginTop: 0 }}>
            {t.modalIntro}
          </p>
          <ReasonSelector
            category="sensitive-data"
            value={reason}
            details={details}
            onChange={setReason}
            onDetailsChange={setDetails}
            lang={lang}
            required
            darkMode={darkMode}
          />
        </ReusableModal>
      )}
    </>
  )
}
