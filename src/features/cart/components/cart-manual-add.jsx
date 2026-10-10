import { useState, useMemo, useRef, useEffect, useId } from 'react'
import { LuSearch, LuPlus, LuX, LuPackage } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { useIngredients } from '@shared/contexts/data-provider'
import { getPacksForIngredient } from '@features/cart/lib/cart-helpers'
import { formatPrix } from '@shared/lib/i18n/prix'
import { suffixS } from '@shared/lib/i18n/pluralize'

// Ajout manuel d'ingrédients au panier (hors recette).
// Conditionnements adaptés à chaque ingrédient (référence
//           grande surface), plus de fallback mini-form qty/unit libre.
//
// Pattern UX :
//   1. Search bar en permanence (compact, icône loupe + input)
//   2. Au focus / typing : dropdown avec suggestions
//      • Si query vide → 5 ingrédients par défaut (lait, œufs, pain,
//        farine, beurre, ou les premiers de la base si manquants)
//      • Si query ≥ 2 caractères → filtre live (max 8 résultats,
//        tolérant aux accents)
//   3. Clic sur une suggestion → liste des conditionnements vendus en
//      grande surface pour cet ingrédient (référence grande surface FR
//      2025-2026 si dispo, sinon fallback par sous-catégorie via
//      `defaultPacksByCategory.js`)
//   4. Clic sur un pack → ajout immédiat au panier
//   5. Indicateur « déjà ajouté » si l'ingrédient est déjà dans le panier
//
// L'item ajouté est inséré avec recipe_id=null (cf. migration
// 20260503_basket_manual_add.sql).

const I18N = {
  fr: {
    searchLabel: 'Ajouter un ingrédient',
    searchExample: 'ex. : lait, pâtes',
    suggestionsTitle: 'Suggestions',
    noResults: 'Aucun ingrédient trouvé.',
    alreadyAdded: 'Déjà dans le panier',
    cancel: 'Annuler',
    chooseFormat: 'Choisis un conditionnement',
    addError: 'Erreur réseau, réessaie',
    resultsCount: (n) => `${n} résultat${suffixS(n, 'fr')}`,
  },
  en: {
    searchLabel: 'Add an ingredient',
    searchExample: 'e.g. milk, pasta',
    suggestionsTitle: 'Suggestions',
    noResults: 'No ingredient found.',
    alreadyAdded: 'Already in cart',
    cancel: 'Cancel',
    chooseFormat: 'Choose a pack',
    resultsCount: (n) => `${n} result${suffixS(n, 'en')}`,
    addError: 'Network error, please retry',
  },
}

// Mots-clés (en FR) qui définissent les 5 suggestions par défaut quand
// l'utilisateur n'a pas encore d'historique de panier. Le matching se
// fait sur le label FR (insensible à la casse). On prend le 1er match.
const DEFAULT_SUGGESTION_KEYWORDS = ['lait', 'œuf', 'pain', 'farine', 'beurre']

// Aplatit l'arbre INGREDIENTS (par sous-catégorie) en liste plate avec
// la sous-catégorie incluse, pour pouvoir chercher partout.
function flattenIngredients(ingredientsByCat) {
  const out = []
  for (const [subcat, items] of Object.entries(ingredientsByCat ?? {})) {
    for (const item of items ?? []) {
      if (item?.id) out.push({ ...item, _subcat: subcat })
    }
  }
  return out
}

// Normalise une chaîne pour la recherche : lowercase + suppression des
// diacritiques (« é » → « e »). Permet de trouver « œuf » en tapant « oeuf ».
function normalize(s) {
  return (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe')
}

export default function CartManualAdd({ lang = 'fr', darkMode = false, basket = [], onAdd }) {
  const t = I18N[lang] ?? I18N.fr
  const ingredientsByCat = useIngredients()
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [expandedId, setExpandedId] = useState(null)  // id de l'item dont le pack chooser est ouvert
  const [pendingIngId, setPendingIngId] = useState(null)
  const [errorIngId, setErrorIngId]     = useState(null)

  // Liste plate des ingrédients (cached) — toutes les sous-catégories
  // confondues, pour pouvoir chercher partout.
  const allIngredients = useMemo(() => flattenIngredients(ingredientsByCat), [ingredientsByCat])

  // ID des ingrédients déjà dans le panier (pour le badge « déjà ajouté »).
  const inBasketIds = useMemo(() => {
    const set = new Set()
    for (const it of basket) if (it.ingredient_id) set.add(it.ingredient_id)
    return set
  }, [basket])

  // Suggestions par défaut : 5 ingrédients génériques (lait, œuf, pain,
  // farine, beurre) trouvés par mot-clé. Si certains manquent dans la
  // base de l'utilisateur, on prend les premiers ingrédients fréquents
  // (premiers de la liste).
  const defaultSuggestions = useMemo(() => {
    const out = []
    const seenIds = new Set()
    for (const keyword of DEFAULT_SUGGESTION_KEYWORDS) {
      const norm = normalize(keyword)
      const found = allIngredients.find(ing => {
        if (seenIds.has(ing.id)) return false
        const labelFr = normalize(ing.labels?.fr)
        return labelFr.includes(norm)
      })
      if (found) {
        out.push(found)
        seenIds.add(found.id)
      }
    }
    // Si on n'en a pas 5, compléter avec les 1ers ingrédients de la liste.
    if (out.length < 5) {
      for (const ing of allIngredients) {
        if (out.length >= 5) break
        if (!seenIds.has(ing.id)) {
          out.push(ing)
          seenIds.add(ing.id)
        }
      }
    }
    return out
  }, [allIngredients])

  // Résultats live de la recherche : top 8 ingrédients dont le label
  // contient la query (lang courante en priorité, fallback FR).
  const filtered = useMemo(() => {
    if (!query.trim() || query.trim().length < 2) return []
    const norm = normalize(query)
    return allIngredients
      .filter(ing => {
        const labelLang = normalize(ing.labels?.[lang])
        const labelFr = normalize(ing.labels?.fr)
        return labelLang.includes(norm) || labelFr.includes(norm)
      })
      .slice(0, 8)
  }, [allIngredients, query, lang])

  // Liste affichée dans le dropdown : suggestions par défaut si vide,
  // sinon résultats filtrés.
  const displayed = query.trim().length >= 2 ? filtered : defaultSuggestions
  const showDropdown = focused || query.trim().length > 0
  const isSearching = query.trim().length >= 2

  // Click outside ferme le dropdown.
  useEffect(() => {
    if (!showDropdown) return
    const onDoc = e => {
      if (!containerRef.current?.contains(e.target)) {
        setFocused(false)
        setExpandedId(null)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [showDropdown])

  const handleExpand = (ing) => {
    setExpandedId(ing.id)
  }

  const handleCancel = () => {
    setExpandedId(null)
  }

  const handlePickPack = async (ing, pack) => {
    if (pendingIngId) return
    setPendingIngId(ing.id)
    setErrorIngId(null)
    // Filet de sécurité 8 s : si onAdd hang, relâche le verrou et affiche une
    // erreur brève pour que l'utilisateur sache qu'il faut réessayer.
    let timedOut = false
    const safetyTimer = setTimeout(() => {
      timedOut = true
      setPendingIngId(null)
      setErrorIngId(ing.id)
      setTimeout(() => setErrorIngId(null), 3000)
    }, 8000)
    try {
      const labelLang = ing.labels?.[lang] ?? ing.labels?.fr ?? ''
      const result = await onAdd?.({
        ingredient_id: ing.id,
        label: labelLang,
        amount: pack.size,
        unit: pack.unit,
        price: pack.price ?? null,
      })
      if (timedOut) return
      if (result?.error) {
        setErrorIngId(ing.id)
        setTimeout(() => setErrorIngId(null), 3000)
        return
      }
      setExpandedId(null)
      setQuery('')
      setFocused(false)
    } catch (err) {
      if (import.meta.env.DEV) console.error('[cart-manual-add] add failed:', err)
      if (!timedOut) {
        setErrorIngId(ing.id)
        setTimeout(() => setErrorIngId(null), 3000)
      }
    } finally {
      clearTimeout(safetyTimer)
      if (!timedOut) setPendingIngId(null)
    }
  }

  const champId = useId()

  // Couleurs adaptatives mode clair/sombre, alignées avec le reste de l'app.
  const bg     = darkMode ? '#131E2C' : '#FFFFFF'
  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? 'rgba(240,232,220,0.6)' : 'rgba(44,26,14,0.55)'
  const border = darkMode ? 'rgba(247,168,94,0.20)' : 'rgba(212,106,16,0.18)'
  const inputBg     = darkMode ? '#1A2535' : '#FAF6EE'
  const hoverBg     = darkMode ? 'rgba(247,168,94,0.10)' : 'rgba(212,106,16,0.07)'

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Un libellé visible, le texte grisé en exemple (décision du
          2026-10-06, « libellés = visibles »). */}
      <label htmlFor={champId} style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: muted, marginBottom: '6px' }}>
        {t.searchLabel}
      </label>
      {/* ─── Search input ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 12px',
        borderRadius: '10px',
        background: inputBg,
        border: `1px solid ${focused ? 'rgba(212,106,16,0.45)' : border}`,
        transition: 'border-color 0.15s, background 0.15s',
      }}>
        <LuSearch size={16} aria-hidden="true" style={{ color: muted, flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          id={champId}
          placeholder={t.searchExample}
          style={{
            flex: 1, minWidth: 0,
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: '13px', color: fg,
            fontFamily: 'inherit',
          }}
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setQuery(''); inputRef.current?.focus() }}
            aria-label={t.cancel}
            className="h-auto w-auto p-0.5"
            style={{ color: muted }}
          >
            <LuX size={14} aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* ─── Dropdown suggestions ─── */}
      {showDropdown && (
        <div
          role="listbox"
          aria-label={t.suggestionsTitle}
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            background: bg,
            border: `1px solid ${border}`,
            borderRadius: '10px',
            boxShadow: darkMode
              ? '0 8px 24px rgba(0,0,0,0.45)'
              : '0 8px 24px rgba(212,106,16,0.16), 0 1px 3px rgba(44,26,14,0.06)',
            zIndex: 50,
            overflow: 'hidden',
            maxHeight: '320px',
            overflowY: 'auto',
          }}
        >
          {/* Titre dropdown */}
          <div style={{
            padding: '8px 12px',
            fontSize: '10px', fontWeight: 700,
            color: 'var(--color-warm-600)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            background: darkMode ? 'rgba(247,168,94,0.04)' : 'rgba(212,106,16,0.03)',
            borderBottom: `1px solid ${border}`,
          }}>
            {isSearching ? t.resultsCount(displayed.length) : t.suggestionsTitle}
          </div>

          {displayed.length === 0 ? (
            <div style={{ padding: '14px 14px', fontSize: '13px', color: muted, textAlign: 'center' }}>
              {t.noResults}
            </div>
          ) : (
            displayed.map(ing => {
              const isExpanded = expandedId === ing.id
              const isInBasket = inBasketIds.has(ing.id)
              const labelLang = ing.labels?.[lang] ?? ing.labels?.fr ?? ''
              return (
                <div
                  key={ing.id}
                  role="option"
                  aria-selected={isExpanded}
                  style={{
                    borderBottom: `1px solid ${border}`,
                    background: isExpanded ? hoverBg : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Ligne principale */}
                  {!isExpanded && (
                    <Button
                      variant="ghost"
                      onClick={() => handleExpand(ing)}
                      disabled={isInBasket}
                      className="h-auto w-full justify-start rounded-none bg-transparent px-3 py-2.5 text-left hover:bg-transparent disabled:opacity-50"
                      style={{
                        gap: '10px',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (!isInBasket) e.currentTarget.style.background = hoverBg }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <span aria-hidden="true" style={{ fontSize: '18px', flexShrink: 0 }}>{ing.emoji ?? '🥕'}</span>
                      <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: fg }}>
                        {labelLang}
                      </span>
                      {isInBasket ? (
                        <span style={{
                          fontSize: '10px', fontWeight: 700,
                          color: muted,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                        }}>
                          {t.alreadyAdded}
                        </span>
                      ) : (
                        <span aria-hidden="true" style={{
                          width: '24px', height: '24px',
                          borderRadius: '50%',
                          background: 'var(--gradient-deep)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white',
                          flexShrink: 0,
                          boxShadow: '0 2px 6px rgba(212,106,16,0.30)',
                        }}>
                          <LuPlus size={14} />
                        </span>
                      )}
                    </Button>
                  )}

                  {/* Mode étendu : liste des conditionnements grande surface
                      pour cet ingrédient. v3.27.3 : `getPacksForIngredient`
                      garantit toujours au moins un pack (spécifique ou
                      fallback par sous-catégorie via defaultPacksByCategory).
                      Plus de fallback mini-form qty/unit libre — pour rester
                      cohérent avec la vente réelle en grande surface. */}
                  {isExpanded && (() => {
                    const packs = getPacksForIngredient(ing.id, lang, ing._subcat)
                    const isLoading = pendingIngId === ing.id
                    const hasError  = errorIngId === ing.id
                    return (
                      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span aria-hidden="true" style={{ fontSize: '18px', flexShrink: 0 }}>{ing.emoji ?? '🥕'}</span>
                          <span style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: fg, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {labelLang}
                          </span>
                          <Button
                            variant="secondary"
                            size="icon"
                            onClick={handleCancel}
                            disabled={isLoading}
                            aria-label={t.cancel}
                            title={t.cancel}
                            className="h-7 w-7 rounded-[7px] flex-shrink-0"
                            style={{ borderColor: border, color: muted }}
                          >
                            <LuX size={14} aria-hidden="true" />
                          </Button>
                        </div>

                        {hasError && (
                          <div style={{
                            fontSize: '11px', fontWeight: 600,
                            color: '#E53E3E',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: 'rgba(229,62,62,0.08)',
                          }}>
                            {t.addError}
                          </div>
                        )}

                        <div style={{
                          fontSize: '10px', fontWeight: 700,
                          color: 'var(--color-warm-600)',
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                          <LuPackage size={11} aria-hidden="true" />
                          {t.chooseFormat}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {packs.map((pack, i) => (
                            <Button
                              key={i}
                              variant="ghost"
                              type="button"
                              onClick={() => handlePickPack(ing, pack)}
                              disabled={isLoading}
                              className="h-auto rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-transparent disabled:opacity-55"
                              style={{
                                gap: '6px',
                                borderColor: border,
                                background: bg,
                                color: fg,
                                transition: 'background 0.15s, border-color 0.15s, transform 0.15s, opacity 0.15s',
                              }}
                              onMouseEnter={e => {
                                if (isLoading) return
                                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(247,168,94,0.18) 0%, rgba(212,106,16,0.10) 100%)'
                                e.currentTarget.style.borderColor = 'rgba(212,106,16,0.45)'
                                e.currentTarget.style.transform = 'translateY(-1px)'
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = bg
                                e.currentTarget.style.borderColor = border
                                e.currentTarget.style.transform = 'translateY(0)'
                              }}
                            >
                              <span style={{ fontWeight: 700 }}>
                                {pack.size} {pack.unit}
                              </span>
                              {pack.price != null && (
                                <span style={{ color: 'var(--color-warm-600)', fontWeight: 700 }}>
                                  {formatPrix(pack.price, lang, { approx: true })}
                                </span>
                              )}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
