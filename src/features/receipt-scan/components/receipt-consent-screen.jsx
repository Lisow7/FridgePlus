import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { LuX } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { Z_INDEX } from '@shared/lib/z-index'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'

const I18N = {
  fr: {
    eyebrow: 'AVANT DE PRENDRE LA PHOTO',
    title: 'On identifie tes ingrédients',
    body: "On lit les noms des produits de ton ticket pour te proposer de les ajouter à ton frigo — après relecture, jamais automatiquement.",
    trust: "Aucune photo n’est conservée. Analysée par Google Cloud Vision puis immédiatement supprimée. Seuls les noms d’ingrédients que tu valides sont gardés.",
    tips: ['📄 À plat, sur une surface stable', '💡 Lumière naturelle, sans flash', '🧾 Ticket entier dans le cadre'],
    cancel: 'Annuler',
    continue: 'Continuer',
    close: 'Fermer',
  },
  en: {
    eyebrow: 'BEFORE TAKING THE PHOTO',
    title: 'Identifying your ingredients',
    body: "We read the product names on your receipt to suggest adding them to your fridge — after review, never automatically.",
    trust: 'No photo is kept. Analysed by Google Cloud Vision then immediately deleted. Only the ingredient names you confirm are kept.',
    tips: ['📄 Flat, on a stable surface', '💡 Natural light, no flash', '🧾 Whole receipt in frame'],
    cancel: 'Cancel',
    continue: 'Continue',
    close: 'Close',
  },
}

export default function ReceiptConsentScreen({ lang = 'fr', darkMode = false, onFileSelected, onCancel }) {
  const t = I18N[lang] ?? I18N.fr
  const inputRef = useRef(null)
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, { active: true, onEscape: onCancel })
  useCloseOnBackButton(true, onCancel)

  const handleContinue = () => {
    inputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-sélectionner le même fichier ensuite
    if (file) onFileSelected?.(file)
  }

  const bg = darkMode ? '#0F1923' : 'rgba(0,0,0,0.45)'

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: Z_INDEX.MODAL,
        background: bg, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
    >
      <div
        ref={dialogRef}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: '380px',
          background: 'linear-gradient(180deg,#221610,#160e07)',
          border: '1px solid rgba(247,168,94,0.16)', borderRadius: '20px',
          padding: '22px 20px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
      >
        <Button
          variant="ghost" size="icon" onClick={onCancel} aria-label={t.close}
          className="absolute right-3 top-3 h-[30px] w-[30px] rounded-lg p-0 hover:bg-transparent"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(240,232,220,0.5)' }}
        >
          <LuX size={15} aria-hidden="true" />
        </Button>

        <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: '#E8924A', textAlign: 'center', marginBottom: '10px' }}>
          {t.eyebrow}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '40px', filter: 'drop-shadow(0 0 14px rgba(224,120,32,0.5))' }}>🧾</span>
        </div>
        <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#F5EBDD', textAlign: 'center', margin: '0 0 10px' }}>
          {t.title}
        </h2>
        <p style={{ fontSize: '13.5px', lineHeight: 1.55, color: '#E4D9C7', textAlign: 'center', margin: '0 auto 16px', maxWidth: '300px' }}>
          {t.body}
        </p>

        <div style={{
          display: 'flex', gap: '9px', alignItems: 'flex-start',
          background: 'rgba(247,168,94,0.10)', border: '1px solid rgba(247,168,94,0.28)',
          borderRadius: '13px', padding: '11px 12px', marginBottom: '14px',
        }}>
          <span style={{ fontSize: '17px' }}>🔒</span>
          <span style={{ fontSize: '12px', lineHeight: 1.45, color: '#F0E4D2' }}>{t.trust}</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginBottom: '18px' }}>
          {t.tips.map(tip => (
            <span key={tip} style={{
              fontSize: '11px', fontWeight: 700, color: '#F0E4D2',
              background: 'rgba(34,22,16,0.85)', border: '1px solid rgba(247,168,94,0.35)',
              borderRadius: '999px', padding: '5px 11px',
            }}>{tip}</span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <Button
            variant="ghost" onClick={onCancel}
            className="h-auto rounded-[11px] border border-white/20 bg-transparent px-4 py-2.5 text-[13px] font-semibold hover:bg-transparent"
            style={{ color: '#D9CBB8' }}
          >
            {t.cancel}
          </Button>
          <Button
            onClick={handleContinue}
            className="h-auto rounded-[11px] px-5 py-2.5 text-[13.5px] font-extrabold"
            style={{ background: '#B85000', color: '#fff', boxShadow: '0 6px 18px rgba(184,80,0,0.45)' }}
          >
            {t.continue} →
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>,
    document.body,
  )
}
