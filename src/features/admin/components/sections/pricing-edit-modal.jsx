// Phase H.2 : modale d'édition d'un ingrédient pricing.
//
// Permet d'éditer **les prix uniquement** des packs existants pour un
// ingrédient donné, dans toutes les langues. Les sizes/units ne sont pas
// éditables ici (changement structurel rare, à faire en JS source).
//
// Pattern : édition en mémoire — la modale renvoie l'objet packs mis à jour
// au parent via `onSave`. Le parent stocke les modifs dans son state et les
// applique lors du téléchargement du JSON.
//
// RGPD : aucune donnée perso impliquée — c'est de la donnée de référence.

import { useState, useEffect, useRef, useId } from 'react'
import { LuX, LuCheck, LuPackage } from 'react-icons/lu'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import Button from '@shared/ui/button'

const I18N = {
  fr: {
    title: 'Éditer les prix',
    cancel: 'Annuler',
    save: 'Enregistrer',
    noPacks: 'Aucun pack défini pour cet ingrédient.',
    helpHint: 'Tu modifies uniquement les prix. Les tailles et unités ne sont pas éditables ici (rare, à faire dans le code source).',
    invalidPrice: 'Prix invalide',
  },
}

const LANGS = ['fr', 'en', 'es', 'de', 'ja']
const LANG_LABELS = { fr: 'FR 🇫🇷', en: 'EN 🇬🇧', }
const CURRENCY = { fr: '€', en: '£', }

/**
 * @param {object} props
 * @param {object} props.ingredient   — { id, label, subcat }
 * @param {object} props.currentPacks — { fr: [{size, unit, price}], en: [...], ... }
 * @param {function} props.onSave     — (newPacks) => void
 * @param {function} props.onClose    — () => void
 */
export default function PricingEditModal({ ingredient, currentPacks, onSave, onClose, darkMode = false }) {
  const t = I18N.fr
  const containerRef = useRef(null)
  // Noms des champs de prix = ce que l'écran montre (décision du
  // 2026-10-06) : l'en-tête de la langue nomme le groupe, le format écrit à
  // gauche nomme le champ.
  const baseId = useId()
  useFocusTrap(containerRef, { active: true, onEscape: onClose })
  useCloseOnBackButton(true, onClose)

  // État local : copie profonde des packs pour édition.
  const [packs, setPacks] = useState(() => {
    const copy = {}
    for (const l of LANGS) {
      copy[l] = (currentPacks?.[l] ?? []).map(p => ({ ...p }))
    }
    return copy
  })

  // Indice si quelque chose a changé.
  const [dirty, setDirty] = useState(false)

  // Validation : tous les prix doivent être > 0.
  const allValid = LANGS.every(l => (packs[l] ?? []).every(p => Number.isFinite(p.price) && p.price > 0))

  function handlePriceChange(langCode, packIdx, raw) {
    const num = parseFloat(String(raw).replace(',', '.'))
    setPacks(prev => {
      const next = { ...prev }
      next[langCode] = [...(next[langCode] ?? [])]
      next[langCode][packIdx] = { ...next[langCode][packIdx], price: Number.isFinite(num) ? num : NaN }
      return next
    })
    setDirty(true)
  }

  function handleSave() {
    if (!allValid) return
    onSave(packs)
  }

  // Couleurs adaptatives.
  const bg     = darkMode ? '#131E2C' : '#FFFFFF'
  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? 'rgba(240,232,220,0.6)' : 'rgba(44,26,14,0.55)'
  const border = darkMode ? 'rgba(247,168,94,0.20)' : 'rgba(212,106,16,0.18)'
  const inputBg= darkMode ? '#1A2535' : '#FAF6EE'

  // Échap pour fermer
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pricing-edit-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        ref={containerRef}
        style={{
          background: bg, color: fg,
          border: `1px solid ${border}`, borderRadius: '12px',
          maxWidth: '720px', width: '100%', maxHeight: '90dvh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        {/* ─── Header ─── */}
        <div style={{
          padding: '14px 18px', borderBottom: `1px solid ${border}`,
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id="pricing-edit-title" style={{ fontSize: '14px', fontWeight: 700 }}>
              {t.title}
            </div>
            <div style={{ fontSize: '13px', color: muted, marginTop: '2px' }}>
              <strong style={{ color: fg }}>{ingredient.label}</strong>
              <span style={{ marginLeft: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
                {ingredient.id}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t.cancel}
            className="h-8 w-8 rounded-lg border bg-transparent hover:bg-transparent"
            style={{ borderColor: border, color: muted }}
          >
            <LuX size={16} aria-hidden="true" />
          </Button>
        </div>

        {/* ─── Body ─── */}
        <div style={{ padding: '14px 18px', overflowY: 'auto', flex: 1 }}>
          <p style={{ fontSize: '12px', color: muted, margin: '0 0 14px 0' }}>
            {t.helpHint}
          </p>

          {LANGS.every(l => !packs[l]?.length) ? (
            <div style={{ padding: '24px', textAlign: 'center', color: muted, fontSize: '13px' }}>
              {t.noPacks}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {LANGS.map(l => (
                (packs[l]?.length > 0) && (
                  <div key={l} role="group" aria-labelledby={`${baseId}-${l}`} style={{
                    border: `1px solid ${border}`, borderRadius: '8px', padding: '10px 12px',
                  }}>
                    <div id={`${baseId}-${l}`} style={{
                      fontSize: '11px', fontWeight: 700, marginBottom: '8px',
                      color: 'var(--color-warm-600)', letterSpacing: '0.04em',
                    }}>
                      {LANG_LABELS[l]}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {packs[l].map((p, idx) => {
                        const validity = Number.isFinite(p.price) && p.price > 0
                        return (
                          <div key={idx} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '6px 8px',
                          }}>
                            <LuPackage size={12} aria-hidden="true" style={{ color: muted, flexShrink: 0 }} />
                            <label htmlFor={`${baseId}-${l}-${idx}`} style={{
                              minWidth: '70px', fontSize: '13px', fontWeight: 600,
                              fontFamily: 'monospace',
                            }}>
                              {p.size} {p.unit}
                            </label>
                            <input
                              id={`${baseId}-${l}-${idx}`}
                              type="text"
                              inputMode="decimal"
                              value={Number.isFinite(p.price) ? p.price : ''}
                              onChange={e => handlePriceChange(l, idx, e.target.value)}
                              style={{
                                flex: 1, maxWidth: '120px',
                                padding: '6px 10px',
                                background: inputBg,
                                border: `1px solid ${validity ? border : '#E03131'}`,
                                borderRadius: '6px',
                                color: validity ? fg : '#E03131',
                                fontSize: '13px', fontFamily: 'inherit',
                                textAlign: 'right',
                              }}
                            />
                            <span style={{ color: muted, fontSize: '13px', minWidth: '12px' }}>
                              {CURRENCY[l]}
                            </span>
                            {!validity && (
                              <span style={{ fontSize: '10px', color: '#E03131' }}>
                                {t.invalidPrice}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div style={{
          padding: '12px 18px', borderTop: `1px solid ${border}`,
          display: 'flex', justifyContent: 'flex-end', gap: '8px',
        }}>
          <Button
            variant="secondary"
            onClick={onClose}
            className="h-auto rounded-lg border bg-transparent px-3.5 py-2 text-[13px] font-semibold"
            style={{ borderColor: border, color: fg }}
          >
            {t.cancel}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!dirty || !allValid}
            className="inline-flex h-auto rounded-lg px-3.5 py-2 text-[13px] font-bold"
            style={{
              gap: '6px',
              background: (!dirty || !allValid)
                ? 'rgba(127,127,127,0.3)'
                : 'var(--gradient-warm)',
              color: (!dirty || !allValid) ? muted : '#2C1A0E',
            }}
          >
            <LuCheck size={14} aria-hidden="true" />
            {t.save}
          </Button>
        </div>
      </div>
    </div>
  )
}
