import { useState, useEffect } from 'react'
import { LuTrash2, LuCheck, LuTriangleAlert, LuChevronDown } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { useDialogue } from '@shared/hooks/use-dialogue'
import { compterLesDepenses } from '@shared/api/spending'

// Section « Effacer mon historique de dépenses » — Sprint 10 S10.c.5.
// Implémente RGPD Article 17 (droit à l'effacement) ciblé : permet
// d'effacer rétroactivement les snapshots déjà capturés dans
// `spending_events`. Complémentaire à l'opt-out Article 21 (S10.c.3/4)
// qui ne couvre que les futures captures.
//
// Pas de soft delete (Article 17 exige un effacement effectif). La
// suppression est confirmée par un dialog modal pour éviter le tap
// accidentel — pas de saisie de mot de passe (la zone de danger compte
// suppression compte est plus dangereuse et nécessite déjà le password).

const I18N = {
  fr: {
    title: 'Supprimer mon historique de dépenses',
    description: 'Tu peux supprimer définitivement toutes les dépenses enregistrées par « J’ai fait mes courses » (c’est ton droit à l’effacement). Le graphique « Analyse des dépenses » Premium repartira à zéro. Cette action est irréversible.',
    btn: 'Supprimer mon historique',
    confirmTitle: 'Supprimer ton historique de dépenses ?',
    confirmText: 'Toutes tes dépenses enregistrées ({count}) seront supprimées définitivement. Cette action ne peut pas être annulée.',
    confirmEmpty: 'Tu n’as encore aucune dépense enregistrée à supprimer.',
    confirmTextSansNombre: 'Toutes tes dépenses enregistrées seront supprimées définitivement. Cette action ne peut pas être annulée.',
    confirmBtn: 'Supprimer définitivement',
    cancelBtn: 'Annuler',
    successLabel: '{count} dépense(s) supprimée(s)',
    errorLabel: 'La suppression a échoué. Réessaie.',
  },
  en: {
    title: 'Delete my spending history',
    description: 'You can permanently delete all the spending recorded by "I’m done shopping" (your right to erasure). The Premium "Spending analysis" chart will restart from zero. This action is irreversible.',
    btn: 'Delete my history',
    confirmTitle: 'Delete your spending history?',
    confirmText: 'All your recorded spending ({count}) will be deleted permanently. This action cannot be undone.',
    confirmEmpty: 'You don’t have any recorded spending to delete yet.',
    confirmTextSansNombre: 'All your recorded spending will be deleted permanently. This action cannot be undone.',
    confirmBtn: 'Delete permanently',
    cancelBtn: 'Cancel',
    successLabel: '{count} record(s) deleted',
    errorLabel: 'Deletion failed. Try again.',
  },
}

export default function EraseSpendingHistorySection({
  userId,
  onErase,              // () => Promise<{ ok: true, count: number } | { error: string }>
  lang,
  isMobile,
  darkMode,
  border,
  textColor,
  mutedColor,
  modalBg,
  collapsible = false,  // Sprint 11 — pliable dans la page Compte
  defaultOpen = true,
}) {
  const t = I18N[lang] ?? I18N.fr
  const [dialogOpen, setDialogOpen] = useState(false)
  const [status, setStatus] = useState(null) // null | 'loading' | 'success' | 'error'
  const [erasedCount, setErasedCount] = useState(0)
  // `null` = pas (encore) compté, ou comptage raté : la confirmation ne dit
  // alors ni un nombre ni « rien à effacer ».
  const [count, setCount] = useState(null)
  const [open, setOpen] = useState(defaultOpen)

  // Même garde que le clic sur le backdrop : pas de fermeture pendant l'appel
  // d'effacement en cours.
  useCloseOnBackButton(dialogOpen, () => { if (status !== 'loading') setDialogOpen(false) })
  // Rôle, nom, piège de focus, Échap et restitution : ce dialogue est DESTRUCTIF
  // (RGPD, effacement d'historique). Jusqu'au lot 9g-2 (audit du 2026-10-04,
  // A11Y-08), son piège appelait `useFocusTrap(dialogRef)` sans jamais poser la
  // ref : rien n'était piégé, Échap ne fermait pas, et il n'avait pas de nom.
  // Pas d'Échap pendant le chargement : on n'interrompt pas un effacement.
  const dialogue = useDialogue({ onClose: () => { if (status !== 'loading') setDialogOpen(false) }, actif: dialogOpen })

  // Le compte des dépenses : quand la section est dépliée (plus dès le
  // montage de la page — une requête de plus sur chaque page Compte, pour
  // une section repliée), et après un effacement réussi (alors 0).
  useEffect(() => {
    if (!userId || !open) return
    let cancelled = false
    compterLesDepenses(userId).then(({ count: c }) => {
      if (!cancelled) setCount(c)
    })
    return () => { cancelled = true }
  }, [userId, status, open])

  const handleConfirm = async () => {
    setStatus('loading')
    const result = await onErase()
    if (result?.error) {
      setStatus('error')
      return
    }
    setErasedCount(result?.count ?? 0)
    setStatus('success')
    setDialogOpen(false)
  }

  return (
    <>
      <section style={{
        padding: isMobile ? '14px' : '16px',
        borderRadius: '12px',
        border: `1px solid ${border}`,
        background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.40)',
        display: 'flex', flexDirection: 'column', gap: '12px',
      }}>
        <div
          role={collapsible ? 'button' : undefined}
          tabIndex={collapsible ? 0 : undefined}
          aria-expanded={collapsible ? open : undefined}
          onClick={collapsible ? () => setOpen((v) => !v) : undefined}
          onKeyDown={collapsible ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v) }
          } : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            cursor: collapsible ? 'pointer' : undefined,
            userSelect: collapsible ? 'none' : undefined,
          }}
        >
          <span style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'var(--gradient-deep)',
            color: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <LuTrash2 size={15} />
          </span>
          {/* <h2> : la section est au niveau des autres sections de la page
              Compte (axe `heading-order` l'a vue en h4 dès qu'elle s'est
              affichée sans Premium — audit du 2026-10-04, PREM-11). */}
          <h2 style={{
            margin: 0, fontSize: isMobile ? '14px' : '15px',
            fontWeight: 800, color: textColor, flex: 1,
          }}>
            {t.title}
          </h2>
          {collapsible && (
            <span aria-hidden="true" style={{
              display: 'inline-flex',
              transition: 'transform 0.18s',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              color: mutedColor,
            }}>
              <LuChevronDown size={18} />
            </span>
          )}
        </div>

        {(!collapsible || open) && (
          <>
            <p style={{
              fontSize: isMobile ? '12px' : '13px',
              color: mutedColor, margin: 0, lineHeight: 1.55,
            }}>
              {t.description}
            </p>

            <Button
              onClick={() => { setStatus(null); setDialogOpen(true) }}
              disabled={status === 'loading'}
              className="h-auto self-start rounded-[10px] text-white shadow-[0_2px_8px_rgba(212,106,16,0.20)]"
              style={{
                gap: '8px',
                padding: isMobile ? '9px 14px' : '10px 16px',
                fontSize: isMobile ? '13px' : '14px',
                background: status === 'success'
                  ? '#16a34a'
                  : status === 'error'
                    ? '#ef4444'
                    : 'var(--gradient-deep)',
              }}
            >
              {status === 'success' && <LuCheck size={15} />}
              {status === 'success'
                ? t.successLabel.replace('{count}', String(erasedCount))
                : status === 'error'
                  ? t.errorLabel
                  : t.btn}
            </Button>
          </>
        )}
      </section>

      {dialogOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget && status !== 'loading') setDialogOpen(false) }}
        >
          <div className="fp-modal-panel" {...dialogue.proprietes} style={{
            background: modalBg, borderRadius: '16px',
            border: `1.5px solid ${border}`,
            padding: '24px', maxWidth: '400px', width: '100%',
            boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <LuTriangleAlert size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
              <h3 id={dialogue.titreId} style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: textColor }}>
                {t.confirmTitle}
              </h3>
            </div>
            <p style={{
              fontSize: '14px', color: mutedColor, marginBottom: '20px',
              lineHeight: 1.55, margin: '0 0 20px',
            }}>
              {count > 0
                ? t.confirmText.replace('{count}', String(count))
                : count === 0 ? t.confirmEmpty : t.confirmTextSansNombre}
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button
                onClick={() => setDialogOpen(false)}
                disabled={status === 'loading'}
                className="h-auto rounded-[10px]"
                style={{
                  flex: 1,
                  padding: '11px', fontSize: '14px', fontWeight: 600,
                  background: darkMode ? 'var(--color-dark-surface)' : '#F5EDE0',
                  color: textColor,
                  border: `1.5px solid ${border}`,
                }}
              >
                {t.cancelBtn}
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={status === 'loading' || count === 0}
                loading={status === 'loading'}
                className="h-auto rounded-[10px] text-white"
                style={{
                  flex: 1,
                  padding: '11px', fontSize: '14px', fontWeight: 700,
                  background: count === 0 ? '#9ca3af' : '#ef4444',
                  border: 'none',
                }}
              >
                {t.confirmBtn}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
