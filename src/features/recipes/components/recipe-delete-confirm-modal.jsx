import { useEffect, useRef, useState } from 'react'
import { LuX, LuTriangleAlert, LuTrash2 } from 'react-icons/lu'
import { countRecipeReferences, deleteCustomRecipeForever } from '@features/recipes/lib/custom-recipes'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import Button from '@shared/ui/button'

// Modale de confirmation pour la suppression définitive RGPD d'une
// recette utilisateur. Conformément à RGPD Article 17 (droit à
// l'effacement) :
//
//   • Affichage explicite du caractère IRRÉVERSIBLE
//   • Stats des données impactées (favoris, paniers)
//   • Checkbox de confirmation OBLIGATOIRE pour activer le bouton
//   • Notif anonyme aux favoriteurs (côté SQL — pas révélation pseudo)
//   • Log preuve dans activity_logs (côté SQL — sans contenu sensible)

const I18N = {
  fr: {
    title:        'Supprimer définitivement ?',
    intro:        (name) => `Tu es sur le point de supprimer définitivement « ${name} ».`,
    irreversible: 'Cette action est IRRÉVERSIBLE. Toutes les données suivantes seront effacées :',
    bulletRecipe: 'La recette elle-même (titre, description, étapes, photo)',
    bulletFav:    (n) => `Sa présence dans les favoris d'autres utilisateurs (${n})`,
    bulletBasket: (n) => `Sa présence dans les paniers actifs (${n})`,
    bulletNoFav:  "Aucun favori d'autre utilisateur impacté",
    bulletNoBasket: 'Aucun panier impacté',
    notifyHint:   "Les utilisateurs qui l'avaient en favori seront informés de manière anonyme (sans ton pseudo ni le titre).",
    checkbox:     'Je comprends que cette action est irréversible',
    closeLabel:   'Fermer',
    cancel:       'Annuler',
    confirm:      'Supprimer définitivement',
    deleting:     'Suppression…',
    success:      'Recette supprimée',
    error:        "Une erreur est survenue. Réessaye dans un instant.",
  },
  en: {
    title:        'Delete permanently?',
    intro:        (name) => `You're about to permanently delete "${name}".`,
    irreversible: 'This action is IRREVERSIBLE. The following data will be erased:',
    bulletRecipe: 'The recipe itself (title, description, steps, photo)',
    bulletFav:    (n) => `Its presence in other users' favorites (${n})`,
    bulletBasket: (n) => `Its presence in active baskets (${n})`,
    bulletNoFav:  'No other-user favorites impacted',
    bulletNoBasket: 'No baskets impacted',
    notifyHint:   "Users who had it in favorites will be notified anonymously (without your username or the recipe title).",
    checkbox:     'I understand this action is irreversible',
    closeLabel:   'Close',
    cancel:       'Cancel',
    confirm:      'Delete permanently',
    deleting:     'Deleting…',
    success:      'Recipe deleted',
    error:        'An error occurred. Please try again.',
  },
}

export default function RecipeDeleteConfirmModal({
  recipeId,
  recipeName = '',
  lang = 'fr',
  darkMode = false,
  onClose,
  onDeleted,
}) {
  const t = I18N[lang] ?? I18N.fr
  const [confirmed, setConfirmed] = useState(false)
  const [refs,      setRefs]      = useState({ favoriters: 0, basket: 0 })
  const [loadingRefs, setLoadingRefs] = useState(true)
  const [submitting,  setSubmitting]  = useState(false)
  const [errorMsg,    setErrorMsg]    = useState(null)
  // Focus trap a11y
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, { active: true, onEscape: onClose })
  useCloseOnBackButton(true, onClose)

  // Charge les compteurs au mount (favoris + paniers impactés)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const counts = await countRecipeReferences(recipeId)
      if (!cancelled) {
        setRefs(counts)
        setLoadingRefs(false)
      }
    })()
    return () => { cancelled = true }
  }, [recipeId])

  async function handleConfirm() {
    if (!confirmed || submitting) return
    setSubmitting(true)
    setErrorMsg(null)
    const { data, error } = await deleteCustomRecipeForever(recipeId)
    if (error) {
      setErrorMsg(error.message ?? t.error)
      setSubmitting(false)
      return
    }
    onDeleted?.(data, recipeId)
    onClose?.()
  }

  const bg = darkMode ? '#0F1925' : '#FFFFFF'
  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'
  const danger = 'var(--color-danger)'

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        background: 'rgba(15,8,2,0.88)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: bg, color: fg,
          borderRadius: 14, maxWidth: 480, width: '100%',
          maxHeight: '90dvh', overflowY: 'auto',
          border: `2px solid ${danger}33`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px', borderBottom: `1px solid ${border}`,
          display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LuTriangleAlert size={22} color={danger} />
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: danger }}>
              {t.title}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t.closeLabel}
            className="h-auto w-auto p-1"
            style={{ color: fg }}
          >
            <LuX size={20} />
          </Button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px', fontSize: 14, lineHeight: 1.55, color: fg }}>
          <p style={{ margin: '0 0 14px' }}>{t.intro(recipeName)}</p>

          <p style={{ margin: '0 0 10px', fontWeight: 700, color: danger }}>
            {t.irreversible}
          </p>

          <ul style={{ paddingLeft: 22, margin: '0 0 14px', color: muted, fontSize: 13 }}>
            <li style={{ marginBottom: 4 }}>{t.bulletRecipe}</li>
            <li style={{ marginBottom: 4 }}>
              {loadingRefs ? '…' : (refs.favoriters > 0 ? t.bulletFav(refs.favoriters) : t.bulletNoFav)}
            </li>
            <li>
              {loadingRefs ? '…' : (refs.basket > 0 ? t.bulletBasket(refs.basket) : t.bulletNoBasket)}
            </li>
          </ul>

          {refs.favoriters > 0 && (
            <p style={{ margin: '0 0 14px', fontSize: 12, color: muted, fontStyle: 'italic' }}>
              {t.notifyHint}
            </p>
          )}

          {/* Checkbox de confirmation */}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '10px 12px', borderRadius: 8,
            background: confirmed ? `${danger}11` : 'transparent',
            border: `1px solid ${confirmed ? `${danger}44` : border}`,
            cursor: 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
          }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              style={{ marginTop: 2, accentColor: danger, flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: fg }}>{t.checkbox}</span>
          </label>

          {errorMsg && (
            <p style={{ marginTop: 10, fontSize: 13, color: danger, fontWeight: 600 }}>
              ⚠️ {errorMsg}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px', borderTop: `1px solid ${border}`,
          display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap',
        }}>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            className="h-auto rounded-lg border px-4 py-2.5 text-[13px] font-semibold"
            style={{ borderColor: border, color: fg }}
          >
            {t.cancel}
          </Button>
          <Button
            onClick={handleConfirm}
            loading={submitting}
            disabled={!confirmed || submitting}
            className="h-auto rounded-lg px-4 py-2.5 text-[13px] font-bold text-white"
            style={{
              background: confirmed ? danger : `${danger}66`,
              opacity: confirmed && !submitting ? 1 : 0.6,
              transition: 'background 0.15s',
            }}
          >
            {!submitting && <LuTrash2 size={14} />}
            {submitting ? t.deleting : t.confirm}
          </Button>
        </div>
      </div>
    </div>
  )
}
