import { useState } from 'react'
import { LuEye, LuEyeOff, LuLock, LuShieldAlert } from 'react-icons/lu'
import ReusableModal from '@shared/ui/reusable-modal'
import ReasonSelector, { isReasonValid, formatReason } from './reason-selector'
import Button from '@shared/ui/button'

// Composant qui cache une donnée sensible derrière un bouton.
// Au clic, ouvre une modale qui demande à l'admin :
//   1. Une raison normalisée (ReasonSelector — catégorie sensitive-data)
//   2. Optionnellement des détails libres
// Au confirme, `charger(motif)` demande la donnée À LA BASE, qui écrit la
// trace AVANT de la rendre (audit du 2026-10-04, ADM-05). La donnée n'est
// donc jamais dans la page avant ce moment — le rideau n'est plus un simple
// rideau d'interface posé sur une donnée déjà chargée. Masquer l'oublie : la
// revoir redemande un motif, et laisse une nouvelle trace.
//
// Utilisation :
//   <SensitiveDataToggle
//     charger={(motif) => adminRevelerCompte(userId, motif)}  // → { donnee, error }
//     lang={lang}
//     darkMode={darkMode}
//   >
//     {(donnee) => <span>{donnee.email}</span>}
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
    logFailed:    "La consultation n'a pas pu être enregistrée au journal : la donnée reste masquée. Réessaie.",
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
    logFailed:    'The access could not be recorded in the audit log: the data stays hidden. Try again.',
  },
}

export default function SensitiveDataToggle({
  charger,
  children,
  lang = 'fr',
  darkMode = false,
}) {
  const t = I18N[lang] ?? I18N.fr
  // La donnée rendue par la base ; `null` tant qu'elle n'a pas été demandée.
  const [donnee,     setDonnee]     = useState(null)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [reason,     setReason]     = useState('')
  const [details,    setDetails]    = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [logError,   setLogError]   = useState(false)

  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? '#A0A8B8' : '#7A6A52'
  const accent = '#9C3B1F'

  function handleOpen() {
    setReason('')
    setDetails('')
    setLogError(false)
    setModalOpen(true)
  }

  async function handleConfirm() {
    if (!isReasonValid({ value: reason, details, required: true })) return
    setSubmitting(true)
    setLogError(false)
    const formatted = formatReason({ value: reason, details, lang })
    let resultat
    try {
      resultat = await charger(formatted)
    } catch (e) { resultat = { donnee: null, error: e ?? new Error('unknown') } }
    setSubmitting(false)
    // La trace est la CONDITION de l'affichage (audit ADM-02 / ADM-05) : la
    // base ne rend la donnée qu'après l'avoir écrite. Sans donnée, rien n'est
    // révélé.
    if (resultat?.error || resultat?.donnee == null) { setLogError(true); return }
    setDonnee(resultat.donnee)
    setModalOpen(false)
  }

  if (donnee != null) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 6 }}>
        {children(donnee)}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDonnee(null)}
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
          {logError && (
            <p role="alert" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--color-danger)', fontWeight: 600, margin: '0 0 10px' }}>
              {t.logFailed}
            </p>
          )}
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
