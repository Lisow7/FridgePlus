import { BASKET_POPOVER_I18N as I18N } from './basket-popover-i18n'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
 LuShoppingCart, LuPlus, LuListChecks, LuChefHat,
 LuPackage, LuChevronRight, LuArrowRight,
} from 'react-icons/lu'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { useConfirm } from '@shared/ui/confirm-dialog/confirm-provider'
import { loadShoppingLists } from '@features/cart/api/shopping-lists'

// Popover panier (mini-aperçu) ouvert depuis l'icône 🛒 du Header.
// Ajout du footer « Mes listes » quand panier vide + listes existent.
// Refonte 3 états distincts pour clarifier les chemins d'entrée :
//
// ÉTAT 1 — Panier vide + 0 liste sauvegardée (premier usage)
// Headline : « Pas encore de liste »
// CTAs : « Accéder au panier » → navigate('/cart')
// « Parcourir les recettes » → onShowRecipes
//
// ÉTAT 2 — Panier vide + N listes sauvegardées
// Preview : top-3 listes les plus récentes (clic = charge + ouvre panel)
// CTAs : « Voir toutes mes listes » → navigate('/cart')
// « Démarrer une liste » → navigate('/cart')
// « Parcourir les recettes » → onShowRecipes
//
// ÉTAT 3 — Panier rempli (inchangé v3.25.0)
// Preview : top-3 items du panier + « + N autres »
// CTA : « Voir ma liste » → navigate('/cart')
//
// RGPD : aucune nouvelle donnée. loadShoppingLists est l'API existante
// (Phase L) avec RLS user-only (déjà conforme).
//
// A11y :
// - role="dialog" + aria-labelledby
// - useFocusTrap : Tab piège, Escape ferme + retour focus au trigger
// - aria-live polite pour annoncer le chargement de liste


const PREVIEW_MAX_ITEMS = 3
const PREVIEW_MAX_LISTS = 3

function formatDate(iso, lang) {
 if (!iso) return ''
 try {
 return new Date(iso).toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang, {
 day: 'numeric', month: 'short',
 })
 } catch {
 return iso.slice(0, 10)
 }
}

export default function BasketPopover({
 open,
 triggerRef,
 basket = [],
 lang = 'fr',
 darkMode = false,
 onClose,
 onShowRecipes,
 userId = null,
 onLoadShoppingList, // v3.61.0 — async (items, listInfo) => { error }
}) {
 const popoverRef = useRef(null)
 const navigate = useNavigate()
 useFocusTrap(popoverRef, { active: open, onEscape: onClose })
 useCloseOnBackButton(open, onClose)
 const confirm = useConfirm()

 // On charge les listes complètes (pas juste le count) pour pouvoir
 // afficher la preview top-3 et permettre le chargement direct au clic.
 const [savedLists, setSavedLists] = useState([])
 const [loadingListId, setLoadingListId] = useState(null)
 const [srMessage, setSrMessage] = useState('')

 useEffect(() => {
 if (!open || !userId) return
 let alive = true
 loadShoppingLists(userId).then(data => {
 if (alive) setSavedLists(data ?? [])
 })
 return () => { alive = false }
 }, [open, userId])

 // Click outside
 useEffect(() => {
 if (!open) return
 const handleClick = e => {
 if (
 !popoverRef.current?.contains(e.target) &&
 !triggerRef?.current?.contains(e.target)
 ) {
 onClose()
 }
 }
 document.addEventListener('mousedown', handleClick)
 return () => document.removeEventListener('mousedown', handleClick)
 }, [open, onClose, triggerRef])

 if (!open) return null

 const t = I18N[lang] ?? I18N.fr
 const activeItems = basket.filter(i => !i.checked)
 const count = activeItems.length
 const isEmpty = count === 0
 const hasSavedLists = savedLists.length > 0

 const preview = activeItems.slice(0, PREVIEW_MAX_ITEMS)
 const remaining = count - preview.length
 const previewLists = savedLists.slice(0, PREVIEW_MAX_LISTS)

 const bg = darkMode ? '#131E2C' : '#FDFAF6'
 const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
 const border = darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'
 const muted = darkMode ? '#7A90A8' : '#7A5F56'
 const sep = darkMode ? '#1E2E42' : 'var(--color-border-warm)'
 const cardBg = darkMode ? 'rgba(247,168,94,0.06)' : 'rgba(212,106,16,0.04)'

 function announceSr(msg) {
 setSrMessage('')
 setTimeout(() => setSrMessage(msg), 50)
 }

 const handleSeeList = () => {
 if (isEmpty) return
 onClose()
 navigate('/cart')
 }

 const handleStartList = () => {
 onClose()
 navigate('/cart')
 }

 const handleBrowseRecipes = () => {
 onShowRecipes?.()
 onClose()
 }

 const handleSeeAllLists = () => {
 onClose()
 navigate('/cart')
 }

 // Chargement direct d'une liste depuis le popover. Si panier
 // non vide, demande confirmation (cohérent avec ShoppingListsModal).
 // Au succès : ouvre le panel panier pour confirmer visuellement.
 const handleLoadList = async (list) => {
 if (loadingListId) return
 const items = list.items ?? []
 // TODO: Garde inatteignable — le seul appelant (renderEmptyWithLists) ne s'affiche
 // que si count===0. Bug pré-existant, indépendant de useConfirm(). Futur fix devrait
 // ajouter test : confirm({title: t.confirmReplace, danger: true}) doit être appelé.
 if (count > 0 && items.length > 0 && !(await confirm({ title: t.confirmReplace, danger: true }))) return
 if (items.length === 0) {
 if (onLoadShoppingList) await onLoadShoppingList([], { id: list.id, name: list.name })
 onClose()
 navigate('/cart')
 return
 }
 if (!onLoadShoppingList) return
 setLoadingListId(list.id)
 const r = await onLoadShoppingList(items, { id: list.id, name: list.name })
 setLoadingListId(null)
 if (r && !r.error) {
 announceSr(t.listLoaded)
 onClose()
 navigate('/cart')
 }
 }

 // ─── Styles partagés boutons CTA ────────────────────────────────────
 const primaryBtnStyle = {
 width: '100%',
 display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
 padding: '11px 14px', borderRadius: 8,
 border: 'none',
 background: 'var(--gradient-warm)',
 color: 'white',
 fontSize: 13, fontWeight: 700,
 cursor: 'pointer',
 transition: 'transform 0.15s',
 fontFamily: 'inherit',
 boxShadow: '0 2px 10px rgba(212,106,16,0.30)',
 }

 const secondaryBtnStyle = {
 width: '100%',
 display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
 padding: '10px 14px', borderRadius: 8,
 border: `1.5px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
 background: 'transparent',
 color: muted,
 fontSize: 12, fontWeight: 600,
 cursor: 'pointer',
 transition: 'background 0.15s',
 fontFamily: 'inherit',
 }

 // ─── Contenu en fonction de l'état ──────────────────────────────────
 const renderEmptyZero = () => (
 <>
 <div style={{
 display: 'flex', flexDirection: 'column', alignItems: 'center',
 gap: 10, padding: '18px 4px 14px', textAlign: 'center',
 }}>
 <div aria-hidden="true" style={{
 width: 56, height: 56, borderRadius: '50%',
 background: 'linear-gradient(135deg, rgba(247,168,94,0.18) 0%, rgba(212,106,16,0.10) 100%)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 color: 'var(--color-warm-600)',
 }}>
 <LuShoppingCart size={26} strokeWidth={1.6} />
 </div>
 <div style={{ fontSize: 14, fontWeight: 700, color: fg }}>
 {t.headlineEmptyZero}
 </div>
 <div style={{ fontSize: 12, color: muted, lineHeight: 1.5, maxWidth: 240 }}>
 {t.descEmptyZero}
 </div>
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
 <button
 onClick={handleBrowseRecipes}
 style={primaryBtnStyle}
 onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
 onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
 >
 <LuChefHat size={15} aria-hidden="true" />
 <span>{t.ctaBrowse}</span>
 </button>
 <button
 onClick={handleStartList}
 style={secondaryBtnStyle}
 onMouseEnter={e => {
 e.currentTarget.style.background = darkMode
 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
 }}
 onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
 >
 <LuPlus size={14} aria-hidden="true" />
 <span>{t.ctaStart}</span>
 </button>
 </div>
 </>
 )

 const renderEmptyWithLists = () => (
 <>
 <p style={{
 fontSize: 11, fontWeight: 700, color: muted,
 textTransform: 'uppercase', letterSpacing: '0.06em',
 margin: '0 0 8px', opacity: 0.7,
 }}>
 {t.headlineEmptyHasLists}
 </p>
 <ul style={{
 listStyle: 'none', padding: 0, margin: '0 0 12px',
 display: 'flex', flexDirection: 'column', gap: 6,
 }}>
 {previewLists.map(list => {
 const itemsCount = Array.isArray(list.items) ? list.items.length : 0
 const isLoading = loadingListId === list.id
 const isClickable = !!onLoadShoppingList
 return (
 <li key={list.id}>
 <button
 onClick={() => handleLoadList(list)}
 disabled={!isClickable || isLoading}
 aria-label={`${t.ctaSeeList} : ${list.name}`}
 style={{
 width: '100%',
 display: 'flex', alignItems: 'center', gap: 10,
 padding: '8px 10px',
 background: cardBg,
 border: `1px solid ${border}`,
 borderRadius: 8,
 color: fg, fontFamily: 'inherit', textAlign: 'left',
 cursor: isClickable && !isLoading ? 'pointer' : 'default',
 opacity: isClickable ? (isLoading ? 0.6 : 1) : 0.55,
 transition: 'background 0.15s, transform 0.15s',
 }}
 onMouseEnter={e => {
 if (!isClickable || isLoading) return
 e.currentTarget.style.background = darkMode
 ? 'rgba(247,168,94,0.12)' : 'rgba(212,106,16,0.08)'
 e.currentTarget.style.transform = 'translateX(2px)'
 }}
 onMouseLeave={e => {
 e.currentTarget.style.background = cardBg
 e.currentTarget.style.transform = 'translateX(0)'
 }}
 >
 <span aria-hidden="true" style={{
 color: 'var(--color-warm-600)', flexShrink: 0,
 display: 'flex', alignItems: 'center',
 }}>
 <LuPackage size={16} />
 </span>
 <div style={{ flex: 1, minWidth: 0 }}>
 <div style={{
 fontSize: 13, fontWeight: 600,
 overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
 color: fg,
 }}>
 {list.name}
 </div>
 <div style={{ fontSize: 11, color: muted, marginTop: 1 }}>
 {t.items(itemsCount)}
 {' · '}
 {formatDate(list.updated_at, lang)}
 </div>
 </div>
 <span aria-hidden="true" style={{
 color: 'var(--color-warm-600)', flexShrink: 0, opacity: isLoading ? 0.4 : 1,
 }}>
 <LuChevronRight size={16} />
 </span>
 </button>
 </li>
 )
 })}
 </ul>
 </>
 )

 const renderFilled = () => (
 <>
 <p style={{
 fontSize: 11, fontWeight: 700, color: muted,
 textTransform: 'uppercase', letterSpacing: '0.06em',
 margin: '0 0 8px', opacity: 0.7,
 }}>
 {t.descFilled}
 </p>
 <ul style={{
 listStyle: 'none', padding: 0, margin: 0,
 display: 'flex', flexDirection: 'column', gap: 5,
 }}>
 {preview.map(item => (
 <li
 key={item.id}
 style={{
 fontSize: 13, color: fg,
 display: 'flex', alignItems: 'center', gap: 8,
 overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
 }}
 >
 <span aria-hidden="true" style={{ color: 'var(--color-warm-500)', flexShrink: 0 }}>•</span>
 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
 {item.label}
 </span>
 </li>
 ))}
 {remaining > 0 && (
 <li style={{
 fontSize: 12, color: muted, fontWeight: 600,
 paddingTop: 4, opacity: 0.85,
 }}>
 {t.moreItems(remaining)}
 </li>
 )}
 </ul>
 </>
 )

 // ─── Choix de la branche d'affichage ────────────────────────────────
 let bodyContent
 if (isEmpty && hasSavedLists) bodyContent = renderEmptyWithLists()
 else if (isEmpty) bodyContent = renderEmptyZero()
 else bodyContent = renderFilled()

 return (
 <div
 ref={popoverRef}
 role="dialog"
 aria-modal="false"
 aria-labelledby="basket-popover-title"
 style={{
 position: 'absolute', top: 'calc(100% + 8px)', right: 0,
 minWidth: 290, maxWidth: 340,
 background: bg, color: fg,
 border: `1.5px solid ${border}`,
 borderRadius: 12,
 boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
 overflow: 'hidden',
 zIndex: 200,
 animation: 'menu-slide-down 0.2s ease both',
 }}
 >
 {/* Live region pour annonces (chargement de liste) */}
 <div role="status" aria-live="polite" aria-atomic="true" style={{
 position: 'absolute', width: 1, height: 1,
 padding: 0, margin: -1, overflow: 'hidden',
 clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
 }}>
 {srMessage}
 </div>

 {/* ─── Titre ──────────────────────────────────────────────── */}
 <div style={{
 padding: '14px 16px 10px',
 borderBottom: `1px solid ${sep}`,
 }}>
 <h3
 id="basket-popover-title"
 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}
 >
 {isEmpty ? t.titleEmpty : t.titleFilled(count)}
 </h3>
 </div>

 {/* ─── Body ───────────────────────────────────────────────── */}
 <div style={{ padding: '14px 16px' }}>
 {bodyContent}
 </div>

 {/* ─── Footer ─────────────────────────────────────────────────────────
   État 2 (vide + listes) : "Voir toutes mes listes" primaire (action
     logique quand le panier est vide), "Accéder à mon panier" secondaire.
   État 3 (rempli) : "Voir toutes mes listes" secondaire (si applicable),
     "Voir ma liste" primaire en dernier (zone pouce).
 ─────────────────────────────────────────────────────────────────── */}
 {(!isEmpty || hasSavedLists) && (
 <div style={{
 padding: '10px 16px 14px',
 borderTop: `1px solid ${sep}`,
 background: darkMode ? 'rgba(26,42,60,0.35)' : 'rgba(245,237,224,0.45)',
 display: 'flex', flexDirection: 'column', gap: 8,
 }}>
 {/* État 2 — panier vide + listes : "Voir toutes mes listes" secondaire en haut,
   "Accéder à mon panier" primaire en bas */}
 {isEmpty && hasSavedLists && (
 <>
 <button
 onClick={handleSeeAllLists}
 aria-label={t.ctaSeeAllLists}
 style={secondaryBtnStyle}
 onMouseEnter={e => {
 e.currentTarget.style.background = darkMode
 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
 }}
 onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
 >
 <LuListChecks size={13} aria-hidden="true" />
 <span>{t.ctaSeeAllLists}</span>
 <LuArrowRight size={11} aria-hidden="true" />
 </button>
 <button
 onClick={handleStartList}
 aria-label={t.ctaStart}
 style={primaryBtnStyle}
 onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
 onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
 >
 <LuShoppingCart size={15} aria-hidden="true" />
 <span>{t.ctaStart}</span>
 </button>
 </>
 )}
 {/* État 3 — panier rempli : "Voir toutes mes listes" secondaire si applicable */}
 {!isEmpty && hasSavedLists && (
 <button
 onClick={handleSeeAllLists}
 aria-label={t.ctaSeeAllLists}
 style={secondaryBtnStyle}
 onMouseEnter={e => {
 e.currentTarget.style.background = darkMode
 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
 }}
 onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
 >
 <LuListChecks size={13} aria-hidden="true" />
 <span>{t.ctaSeeAllLists}</span>
 <LuArrowRight size={11} aria-hidden="true" />
 </button>
 )}
 {/* État 3 — panier rempli : "Voir ma liste" primaire en bas (zone pouce) */}
 {!isEmpty && (
 <button
 onClick={handleSeeList}
 aria-label={t.ctaSeeList}
 style={primaryBtnStyle}
 onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
 onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
 >
 <LuShoppingCart size={15} aria-hidden="true" />
 <span>{t.ctaSeeList}</span>
 </button>
 )}
 </div>
 )}
 </div>
 )
}
