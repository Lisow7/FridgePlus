import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useStockSession } from '@shared/contexts/session-state-context'
import { useIngredientsById, useIngredientLookup } from '@shared/contexts/data-provider'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { useUndo } from '@shared/contexts/undo-provider'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import { searchIngredients } from '@shared/lib/matching/ingredient-search'
import { useTrackIngredientSearch } from '@features/fridge/hooks/use-track-ingredient-search'
import { LuTrash2, LuPlus } from 'react-icons/lu'
import Button from '@shared/ui/button'
import Field from '@shared/ui/field'
import { suffixS } from '@shared/lib/i18n/pluralize'

// Panneau « Mon frigo en un coup d'œil » — bottom sheet listant TOUT le stock,
// groupé par zone, avec recherche + ajout/retrait. Déclenché depuis le footer.
// Répond au besoin : voir d'un coup d'œil ce qu'on a, sans ouvrir chaque
// compartiment. Présentational (lit stock + ingredientsById), rendu en portail.
//
// v2026-07-11 (retour utilisateur, simplifié après un premier essai jugé trop
// chargé) : deux modes plutôt qu'un empilement de filtres. Barre vide → on
// parcourt, groupé par zone comme avant. Dès qu'on tape → la recherche
// s'élargit à tout le catalogue (pas seulement le stock) et devient une
// liste plate sans en-têtes de zone — éclater 2-3 résultats dans plusieurs
// petites sections ralentit la lecture plus qu'elle n'aide. Un seul contrôle
// (rond à cocher) fait à la fois ajouter et retirer, pas deux icônes à
// apprendre. Recherche insensible aux accents, 100% locale (le catalogue est
// déjà chargé côté app) — aucune requête ni terme tapé envoyé où que ce soit.

const I18N = {
  fr: {
    title: (n) => `Mon frigo — ${n} aliment${n > 1 ? 's' : ''}`,
    searchLabel: 'Rechercher un aliment',
    search: 'ex. : yaourt',
    empty: 'Ton frigo est vide. Cherche un aliment ci-dessus pour l\'ajouter.',
    noMatch: (q) => `Aucun aliment ne correspond à « ${q} ».`,
    resultsCount: (n) => (n === 0 ? 'Aucun résultat' : n === 1 ? '1 résultat' : `${n} résultats`),
    close: 'Fermer',
    empty_fridge: 'Vider le frigo',
    remove: (name) => `Retirer ${name}`,
    add: (name) => `Ajouter ${name}`,
    removed: (name) => `${name} retiré`,
  },
  en: {
    title: (n) => `My fridge — ${n} item${suffixS(n, 'en')}`,
    searchLabel: 'Search an item',
    search: 'e.g. yogurt',
    empty: 'Your fridge is empty. Search an item above to add it.',
    noMatch: (q) => `No item matches "${q}".`,
    resultsCount: (n) => (n === 0 ? 'No results' : n === 1 ? '1 result' : `${n} results`),
    close: 'Close',
    empty_fridge: 'Empty the fridge',
    remove: (name) => `Remove ${name}`,
    add: (name) => `Add ${name}`,
    removed: (name) => `${name} removed`,
  },
}

// Zones dérivées du préfixe d'id (cf. categorize-ingredients / README.md).
const ZONES = [
  { key: 'freezer', emoji: '❄️', labels: { fr: 'Congélateur',       en: 'Freezer' },  match: (id) => id.startsWith('frz-') },
  { key: 'fresh',   emoji: '🥬', labels: { fr: 'Frais',             en: 'Fresh' },    match: (id) => id.startsWith('fr-') || id.startsWith('jp-') },
  { key: 'veg',     emoji: '🥕', labels: { fr: 'Légumes & Fruits',  en: 'Fruit & Veg' }, match: (id) => id.startsWith('vg-') },
  { key: 'pantry',  emoji: '🥫', labels: { fr: 'Garde-manger',      en: 'Pantry' },   match: (id) => id.startsWith('gp-') || id.startsWith('sp-') || id.startsWith('bk-') },
]

const zoneEmojiFor = (id) => ZONES.find((z) => z.match(id))?.emoji ?? '📦'

// Filtres fins par sous-catégorie (uniquement en mode recherche, cf. décision
// utilisateur 2026-07-11 — en mode parcours les zones sont déjà des sections,
// des filtres y feraient doublon). Mappés sur les VRAIES sous-catégories
// d'ingrédient (colonne `subcategory` en BDD, cf. `getSubCategory()` de
// `ingredient-lookup.js`) — PAS sur les bacs d'affichage de
// `fridge-layouts.js` : « bof » n'y est qu'un libellé d'écran regroupant
// beurre/œufs/fromage, jamais une vraie subcategory (chaque item y est
// indexé sous dairy/cheese/eggs séparément) — bug corrigé le 2026-07-11
// après retour utilisateur (« mozzarella » introuvable via le filtre BOF).
// Cumulables (multi-sélection). Le filtre « Frais » (redondant une fois
// Viande/Poisson/BOF/Charcuterie corrects) a été retiré à la demande de
// l'utilisateur plutôt que réparé. « Restes » n'a volontairement pas
// d'équivalent ici : ce n'est pas une sous-catégorie d'ingrédient mais une
// feature séparée (user_leftovers).
//
// Sous-catégories réelles volontairement NON couvertes par un filtre dédié
// (basic, dry, tofu, vegan-proteins — ~43 produits au total, trop peu
// nombreux pour justifier une puce chacune) : décision utilisateur, ces
// items restent TOUJOURS visibles quel que soit le filtre actif plutôt que
// d'être exclus silencieusement (cf. filtre `searchMatches` plus bas).
const CATEGORY_FILTERS = [
  { id: 'freezer', emoji: '❄️', labels: { fr: 'Congélateur', en: 'Freezer' }, subcats: ['frozen-meat', 'frozen-fish', 'frozen-veg', 'ready-meals', 'ice-cream', 'frozen-bread'] },
  { id: 'crisper', emoji: '🥦', labels: { fr: 'Fruits & légumes', en: 'Fruit & veg' }, subcats: ['vegetables', 'fruits', 'tropical-fruits'] },
  { id: 'dry', emoji: '🌾', labels: { fr: 'Épicerie sèche', en: 'Dry goods' }, subcats: ['pasta-rice', 'rice', 'canned', 'cereals', 'bread', 'sweet', 'nuts-dried'] },
  { id: 'spices', emoji: '🌿', labels: { fr: 'Épices & condiments', en: 'Spices & condiments' }, subcats: ['salt-spices', 'herbs', 'sauces', 'oils'] },
  { id: 'meat', emoji: '🥩', labels: { fr: 'Viande', en: 'Meat' }, subcats: ['meat'] },
  { id: 'fish', emoji: '🐟', labels: { fr: 'Poisson', en: 'Fish' }, subcats: ['fish'] },
  { id: 'bof', emoji: '🧀', labels: { fr: 'Beurre·Œufs·Fromage', en: 'Dairy & eggs' }, subcats: ['dairy', 'cheese', 'eggs'] },
  { id: 'deli', emoji: '🥓', labels: { fr: 'Charcuterie', en: 'Deli' }, subcats: ['deli'] },
]

// Union de toutes les subcats couvertes par au moins un filtre — sert à
// distinguer « aucun ingrédient de cette vraie sous-catégorie ne matche le
// filtre actif » (exclu) de « cette sous-catégorie n'a simplement aucun
// filtre dédié » (toujours affiché, cf. commentaire ci-dessus).
const ALL_FILTERED_SUBCATS = new Set(CATEGORY_FILTERS.flatMap((c) => c.subcats))

// Ignore accents/casse — tape « creme » ou « oeuf » et ça matche quand même.
// ⚠️ La version locale ne tenait PAS cette promesse : NFD ne décompose pas la
// ligature « œ », donc « boeuf » ne trouvait aucun des huit ingrédients écrits
// « bœuf ». Elle effaçait en plus le dakuten japonais (がぎ → かき).

const BORDER = 'rgba(247,168,94,0.45)'

// Monté/démonté par le parent (rendu conditionnel) → `q` se réinitialise
// naturellement à chaque ouverture, sans effet de reset.
export default function InventoryPanel({ lang = 'fr', darkMode = false, onClose, onEmptyRequest, focusSearch = false }) {
  const { stock, toggleIngredient } = useStockSession()
  const ingredientsById = useIngredientsById()
  const lookup = useIngredientLookup()
  const windowWidth = useWindowWidth()
  const isDesktop = windowWidth >= 1280
  const [q, setQ] = useState('')
  const [activeFilters, setActiveFilters] = useState(() => new Set())
  const t = I18N[lang] ?? I18N.fr

  const toggleFilter = (id) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  useCloseOnBackButton(true, onClose)

  // Piège de focus + Escape + restitution (audit clavier 2026-08-25). Le
  // listener Escape maison qu'il remplace ne piégeait pas Tab : le focus
  // partait derrière le panneau aria-modal.
  const panelRef = useRef(null)
  useFocusTrap(panelRef, { active: true, onEscape: onClose })

  // Ouvert par « Chercher un aliment » : le curseur va dans le champ. Un
  // `autoFocus` ne tient pas — le menu du bouton orange, en se fermant dans le
  // même rendu, rend le focus à son bouton, puis le piège ci-dessus le pose sur
  // « Fermer ». Cet effet, déclaré APRÈS le piège, passe en dernier.
  const searchInputRef = useRef(null)
  useEffect(() => {
    if (focusSearch) searchInputRef.current?.focus()
  }, [focusSearch])

  const resolveName = (id) => {
    const ing = ingredientsById?.get?.(id)
    return ing?.labels?.[lang] ?? ing?.labels?.fr ?? id
  }
  const resolveEmoji = (id) => ingredientsById?.get?.(id)?.emoji ?? '•'

  // Mode « parcours » (barre vide) — uniquement ce qui est déjà au frigo,
  // groupé par zone, comme aujourd'hui.
  const browseGrouped = useMemo(() => {
    const ids = [...(stock ?? [])]
    return ZONES.map((z) => ({
      key: z.key,
      emoji: z.emoji,
      label: z.labels[lang] ?? z.labels.fr,
      items: ids.filter(z.match)
        .map((id) => ({ id, name: resolveName(id), emoji: resolveEmoji(id) }))
        .sort((a, b) => a.name.localeCompare(b.name, lang)),
    })).filter((z) => z.items.length > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock, ingredientsById, lang])

  // Sous-catégories couvertes par les filtres actifs (union) — vide = aucun
  // filtre appliqué, tout passe.
  const activeSubcats = useMemo(
    () => new Set(CATEGORY_FILTERS.filter((c) => activeFilters.has(c.id)).flatMap((c) => c.subcats)),
    [activeFilters],
  )

  // Mode « recherche » (dès qu'on tape) — liste plate sur tout le catalogue,
  // pas seulement le stock, avec un repère de zone par ligne au lieu d'un
  // en-tête de groupe. Filtrable par catégorie fine (sous-catégorie réelle,
  // pas le préfixe d'id grossier de ZONES).
  // Classement et tolérance : cf. `searchIngredients` (début de mot, pluriel,
  // famille → enfants, alias, faute de frappe). Il reçoit le catalogue COMPLET
  // (parents compris) pour pouvoir passer d'une famille à ses enfants ; il ne
  // renvoie jamais un parent.
  const searchMatches = useMemo(() => {
    if (!q.trim()) return []
    return searchIngredients(q, ingredientsById?.values?.() ?? [], { lang })
      .filter(({ id }) => {
        if (activeSubcats.size === 0) return true
        const subcat = lookup?.getSubCategory?.(id)
        if (subcat && !ALL_FILTERED_SUBCATS.has(subcat)) return true
        return activeSubcats.has(subcat)
      })
      .map(({ id, name, ing }) => ({
        id,
        name,
        emoji: ing.emoji ?? '•',
        zoneEmoji: zoneEmojiFor(id),
        owned: stock?.has?.(id) ?? false,
      }))
  }, [q, ingredientsById, lang, stock, activeSubcats, lookup])

  useTrackIngredientSearch(q, searchMatches.length)

  const total = stock?.size ?? 0
  const isSearching = q.trim().length > 0

  // Barre revidée → repart de zéro sur les filtres, pas de filtre fantôme
  // qui traîne silencieusement à la prochaine recherche.
  const handleSearchChange = (value) => {
    setQ(value)
    if (!value.trim() && activeFilters.size > 0) setActiveFilters(new Set())
  }

  const surface = darkMode ? '#14202E' : '#FFFDFB'
  const text = darkMode ? '#EBE4D8' : '#3C2D1E'
  const muted = darkMode ? '#8FA3B8' : '#6A4F45'
  const chipBg = darkMode ? 'rgba(255,255,255,0.05)' : '#fff'
  const inputBg = darkMode ? 'rgba(255,255,255,0.06)' : '#fff'

  // P5 (audit 2026-10-02) : retirer était une coche orange de 22 px — une coche
  // se lit « je l'ai », pas « enlever » — et le retrait était sans retour.
  // Désormais : une poubelle nommée, une zone de 40 px (WCAG 2.5.8 exige 24),
  // et « Annuler » pendant 10 s (useUndo, le même toast que « Vider »).
  // Ajouter reste un « + » : rien n'est perdu, pas d'annulation à offrir.
  const stockRef = useRef(stock)
  useEffect(() => { stockRef.current = stock }, [stock])
  const { trigger: triggerUndo } = useUndo()
  const removeWithUndo = (id, name) => {
    toggleIngredient(id)
    triggerUndo({
      label: t.removed(name),
      onConfirm: () => {},
      // Garde : si l'aliment a été remis entre-temps, « Annuler » ne doit pas l'enlever
      onUndo: () => { if (!stockRef.current?.has?.(id)) toggleIngredient(id) },
    })
  }
  const Toggle = ({ id, name, owned }) => (
    <button
      onClick={() => (owned ? removeWithUndo(id, name) : toggleIngredient(id))}
      aria-label={owned ? t.remove(name) : t.add(name)}
      style={{
        flexShrink: 0, width: 40, height: 40, margin: '-9px -10px -9px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', borderRadius: 10, cursor: 'pointer',
        color: owned ? muted : (darkMode ? '#F7A85E' : '#B85000'),
      }}
    >
      {owned
        ? <LuTrash2 size={17} aria-hidden="true" />
        : <LuPlus size={20} aria-hidden="true" />}
    </button>
  )

  const panelStyle = isDesktop ? {
    position: 'fixed', top: 0, left: 0, width: 460, height: '100dvh', zIndex: 91,
    background: surface, color: text,
    borderRight: `1px solid ${BORDER}`,
    boxShadow: '4px 0 32px rgba(150,95,30,0.20)',
    display: 'flex', flexDirection: 'column',
  } : {
    position: 'fixed', left: '50%', bottom: 0, transform: 'translateX(-50%)',
    width: '100%', maxWidth: 480, zIndex: 91,
    background: surface, color: text,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    boxShadow: '0 -14px 44px rgba(150,95,30,0.26)',
    maxHeight: '82dvh',
    display: 'flex', flexDirection: 'column',
  }

  return createPortal(
    <>
      <div onClick={onClose} aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }} />
      <section ref={panelRef} role="dialog" aria-modal="true" aria-label={t.title(total)} style={panelStyle}>
        <div style={{ flexShrink: 0, background: surface, padding: '16px 16px 10px' }}>
          {!isDesktop && <div style={{ width: 40, height: 4, background: BORDER, borderRadius: 999, margin: '0 auto 12px' }} />}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <strong style={{ color: darkMode ? '#F7A85E' : '#8A5A18', fontSize: 16 }}>🧊 {t.title(total)}</strong>
            <button onClick={onClose} aria-label={t.close} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: muted, width: 40, height: 40, margin: -8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          <Field label={t.searchLabel} labelStyle={{ display: 'block', fontSize: '12px', fontWeight: 700, color: muted, marginBottom: '6px' }}>
          <input
            value={q} onChange={(e) => handleSearchChange(e.target.value)} placeholder={t.search}
            ref={searchInputRef}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1px solid ${BORDER}`, background: inputBg, color: text, fontSize: 14 }}
          />
          </Field>
          {isSearching && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {CATEGORY_FILTERS.map((c) => {
                const on = activeFilters.has(c.id)
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleFilter(c.id)}
                    aria-pressed={on}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                      fontSize: 12.5, fontWeight: 700, lineHeight: 1,
                      border: `1.4px solid ${on ? '#D46A10' : BORDER}`,
                      background: on ? '#B85000' : chipBg,
                      color: on ? '#fff' : text,
                    }}
                  >
                    <span aria-hidden="true">{c.emoji}</span>
                    <span>{c.labels[lang] ?? c.labels.fr}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '4px 16px 18px', flex: 1, overflowY: 'auto' }}>
          {!isSearching && total === 0 && (
            <p style={{ color: muted, fontSize: 14, textAlign: 'center', padding: '24px 8px' }}>{t.empty}</p>
          )}

          {!isSearching && total > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {browseGrouped.map((z) => (
                <div key={z.key}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 13, fontWeight: 700, color: darkMode ? '#F7A85E' : '#8A5A18',
                    textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6,
                  }}>
                    <span aria-hidden="true" style={{
                      display: 'inline-block', width: 3, height: 13, borderRadius: 2,
                      background: 'linear-gradient(180deg, #F7A85E 0%, #D46A10 100%)',
                    }} />
                    <span aria-hidden="true">{z.emoji}</span>
                    <span>{z.label}</span>
                    <span style={{ color: muted, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>({z.items.length})</span>
                  </div>
                  <div style={{ borderRadius: 12, border: `1px solid ${BORDER}`, background: chipBg, overflow: 'hidden' }}>
                    {z.items.map((i, idx) => (
                      <div
                        key={i.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 12px',
                          borderTop: idx === 0 ? 'none' : `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(138,90,24,0.10)'}`,
                        }}
                      >
                        <span aria-hidden="true" style={{ fontSize: 16, flexShrink: 0 }}>{i.emoji}</span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</span>
                        <Toggle id={i.id} name={i.name} owned />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Message d'état (WCAG 4.1.3) : la liste change sans que le focus
              bouge — un lecteur d'écran n'en saurait rien sans cette annonce. */}
          <p role="status" className="sr-only">{isSearching ? t.resultsCount(searchMatches.length) : ''}</p>
          {isSearching && (
            searchMatches.length === 0 ? (
              <p style={{ color: muted, fontSize: 13, textAlign: 'center', padding: '20px 8px' }}>{t.noMatch(q.trim())}</p>
            ) : (
              <div style={{ borderRadius: 12, border: `1px solid ${BORDER}`, background: chipBg, overflow: 'hidden' }}>
                {searchMatches.map((i, idx) => (
                  <div
                    key={i.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px',
                      borderTop: idx === 0 ? 'none' : `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(138,90,24,0.10)'}`,
                    }}
                  >
                    <span aria-hidden="true" style={{ fontSize: 16, flexShrink: 0 }}>{i.emoji}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: i.owned ? text : muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</span>
                    <span aria-hidden="true" style={{ fontSize: 11, opacity: 0.75, flexShrink: 0 }}>{i.zoneEmoji}</span>
                    <Toggle id={i.id} name={i.name} owned={i.owned} />
                  </div>
                ))}
              </div>
            )
          )}
        </div>
        {/* « Vider » vit ici depuis le 2026-09-11 — pas dans le menu du bouton
            orange : action destructrice (hors d'un FAB, Material), et c'est ici
            que l'on VOIT ce qu'on s'apprête à effacer. La confirmation et les
            10 s d'annulation restent celles du FAB, qui passe `onEmptyRequest`. */}
        {onEmptyRequest && (
          <div style={{ flexShrink: 0, padding: '10px 16px 14px', borderTop: `1px solid ${BORDER}`, background: surface }}>
            <Button
              variant="danger"
              size="sm"
              onClick={onEmptyRequest}
              disabled={total === 0}
              className="h-auto w-full justify-center gap-2 py-[9px] text-[13px]"
            >
              <LuTrash2 size={15} aria-hidden="true" />
              {t.empty_fridge}
            </Button>
          </div>
        )}
      </section>
    </>,
    document.body,
  )
}
