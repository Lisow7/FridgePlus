// Modale "Sauvegarder cette liste" (Phase L.3).
//
// Permet à l'utilisateur authentifié de transformer son panier actuel en
// liste sauvegardée nommée. Le nom est validé selon les contraintes BDD
// (1-80 chars). Au save, la liste est créée en BDD via createShoppingList,
// puis le panier est vidé (cf. mémoire project_saved_shopping_lists.md).
//
// RGPD : aucune donnée perso au-delà de ce que l'utilisateur saisit lui-même
// (le nom de la liste). Le snapshot est lié à son user_id (cascade DELETE).
//
// A11y : focus trap, aria-modal, ESC ferme.

import { useState, useRef, useEffect, useId } from 'react'
import { LuX, LuCheck, LuListPlus } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { SHOPPING_LIST_NAME_MAX } from '@features/cart/api/shopping-lists'

const I18N = {
  fr: {
    title: 'Sauvegarder ma liste',
    titleCreate: 'Créer une nouvelle liste',
    nameLabel: 'Nom de la liste',
    placeholder: 'ex. : courses de la semaine',
    cancel: 'Annuler',
    save: 'Sauvegarder',
    create: 'Créer la liste',
    nameTooLong: '80 caractères maximum.',
    nameRequired: 'Donne un nom à ta liste.',
    intro: 'Ta liste actuelle ({{count}} éléments) sera sauvegardée et le panier sera vidé. Tu pourras la rouvrir depuis « Mes listes ».',
    introCreate: 'Donne un nom à ta liste pour commencer à la remplir. Tu pourras y ajouter des recettes et des ingrédients.',
    saving: 'Sauvegarde en cours…',
    error: 'Erreur lors de la sauvegarde. Réessaie.',
    errorLimit: 'Limite atteinte : 50 listes maximum. Supprime-en une pour en créer une nouvelle.',
  },
  en: {
    title: 'Save my list',
    titleCreate: 'Create a new list',
    nameLabel: 'List name',
    placeholder: 'e.g. weekly groceries',
    cancel: 'Cancel',
    save: 'Save',
    create: 'Create list',
    nameTooLong: '80 characters maximum.',
    nameRequired: 'Give your list a name.',
    intro: 'Your current list ({{count}} items) will be saved and the basket will be cleared. You can reopen it from "My lists".',
    introCreate: 'Give your list a name to start filling it. You can then add recipes and ingredients.',
    saving: 'Saving…',
    error: 'Error while saving. Please retry.',
    errorLimit: 'Limit reached: 50 lists maximum. Delete one to create a new one.',
  },
}

/**
 * @param {object} props
 * @param {number} props.itemsCount  — pour afficher "X éléments"
 * @param {Function} props.onConfirm — async (name) => { success: boolean, errorCode?: string }
 * @param {Function} props.onClose
 * @param {string} [props.lang='fr']
 * @param {boolean} [props.darkMode=false]
 */
export default function SaveShoppingListModal({ itemsCount, onConfirm, onClose, lang = 'fr', darkMode = false, isEmpty = false }) {
  const t = I18N[lang] ?? I18N.fr
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const champId = useId()
  useFocusTrap(containerRef, { active: true, onEscape: onClose })
  useCloseOnBackButton(true, onClose)

  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Auto-focus du champ texte à l'ouverture
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const trimmed = name.trim()
  const tooLong = name.length > SHOPPING_LIST_NAME_MAX
  const canSubmit = trimmed.length > 0 && !tooLong && !saving

  async function handleSubmit(e) {
    e?.preventDefault?.()
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const result = await onConfirm(trimmed)
      if (!result?.success) {
        // Erreur connue : limite 50 listes (P0001)
        if (result?.errorCode === 'P0001' || /limite|limit/i.test(result?.errorMessage ?? '')) {
          setError(t.errorLimit)
        } else {
          setError(t.error)
        }
        setSaving(false)
        return
      }
      // Le parent ferme la modale après reset du panier — pas besoin de setSaving(false)
    } catch {
      setError(t.error)
      setSaving(false)
    }
  }

  // Couleurs adaptatives
  const bg     = darkMode ? '#131E2C' : '#FFFFFF'
  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? 'rgba(240,232,220,0.6)' : 'rgba(44,26,14,0.55)'
  const border = darkMode ? 'rgba(247,168,94,0.20)' : 'rgba(212,106,16,0.18)'
  const inputBg= darkMode ? '#1A2535' : '#FAF6EE'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-list-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <form
        ref={containerRef}
        onSubmit={handleSubmit}
        style={{
          background: bg, color: fg,
          border: `1px solid ${border}`, borderRadius: '12px',
          maxWidth: '480px', width: '100%',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: `1px solid ${border}`,
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <span aria-hidden="true" style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'var(--gradient-warm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#2C1A0E', flexShrink: 0,
          }}>
            <LuListPlus size={16} />
          </span>
          <h2 id="save-list-title" style={{ flex: 1, margin: 0, fontSize: '15px', fontWeight: 700 }}>
            {isEmpty ? t.titleCreate : t.title}
          </h2>
          <Button
            variant="secondary"
            size="icon"
            onClick={onClose}
            aria-label={t.cancel}
            className="h-8 w-8 rounded-lg"
            style={{ borderColor: border, color: muted }}
          >
            <LuX size={16} aria-hidden="true" />
          </Button>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '13px', color: muted, margin: 0, lineHeight: 1.5 }}>
            {isEmpty ? t.introCreate : t.intro.replace('{{count}}', itemsCount)}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Un libellé visible, le texte grisé en exemple (décision du
                2026-10-06, « libellés = visibles »). */}
            <label htmlFor={champId} style={{ fontSize: '12px', fontWeight: 700, color: muted }}>{t.nameLabel}</label>
            <input
              id={champId}
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(null) }}
              placeholder={t.placeholder}
              maxLength={SHOPPING_LIST_NAME_MAX + 5}  // un peu de marge pour montrer "trop long"
              disabled={saving}
              aria-invalid={tooLong || (error ? true : false)}
              aria-describedby="save-list-error"
              style={{
                padding: '10px 12px',
                background: inputBg,
                border: `1px solid ${tooLong ? '#E03131' : border}`,
                borderRadius: '8px',
                fontSize: '14px', color: fg, fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span id="save-list-error" style={{ color: error ? '#E03131' : muted }} role="status" aria-live="polite">
                {error ?? (tooLong ? t.nameTooLong : '')}
              </span>
              <span style={{ color: tooLong ? '#E03131' : muted, fontVariantNumeric: 'tabular-nums' }}>
                {name.length} / {SHOPPING_LIST_NAME_MAX}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px', borderTop: `1px solid ${border}`,
          display: 'flex', justifyContent: 'flex-end', gap: '8px',
        }}>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={saving}
            className="h-auto rounded-lg px-3.5 py-2 text-[13px] font-semibold"
            style={{ borderColor: border, color: fg }}
          >
            {t.cancel}
          </Button>
          <Button
            type="submit"
            loading={saving}
            disabled={!canSubmit}
            className={`h-auto rounded-lg px-3.5 py-2 text-[13px] font-bold ${canSubmit ? 'bg-gradient-to-br from-[#F7A85E] to-[#D46A10] text-[#2C1A0E] shadow-[0_2px_8px_rgba(212,106,16,0.30)]' : ''}`}
            style={canSubmit ? undefined : { background: 'rgba(127,127,127,0.3)', color: muted }}
          >
            <LuCheck size={14} aria-hidden="true" />
            {saving ? t.saving : isEmpty ? t.create : t.save}
          </Button>
        </div>
      </form>
    </div>
  )
}
