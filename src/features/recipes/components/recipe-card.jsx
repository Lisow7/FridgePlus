import { memo, useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useBaseRecipes, useCountries, useDietTypes, useAllergenTypes, useIngredientsById } from '@shared/contexts/data-provider'
import { HIDDEN_DIETS } from '@shared/static/recipe-constants'
import { deriveRecipeAllergens, pickCardAllergens } from '@shared/lib/recipes/card-allergens'
import { calcRecipeCost, formatPrice } from '@shared/lib/recipes/recipe-utils'
import { splitPresentMissing } from '@shared/lib/recipes/recipe-scoring'
import { LuHeart, LuShoppingCart } from 'react-icons/lu'
import Emoji from '@shared/ui/emoji'
import RecipeSourceBadge from '@shared/ui/recipe-source-badge'
import Button from '@shared/ui/button'
import { useSubscription } from '@shared/hooks/use-subscription'
import { UpgradeGate } from '@shared/ui/upgrade-gate'
import { useUpgradeModal } from '@shared/contexts/subscription-modal-provider'
import { useAuth } from '@shared/contexts/auth-provider'
import { useWindowWidth } from '@shared/hooks/use-window-width'

function matchColor(pct) {
  if (pct === 100) return '#4CAF7D'
  if (pct >= 76)   return '#7BB078'
  if (pct >= 51)   return '#C4A555'
  if (pct >= 26)   return 'var(--color-brand-500)'
  return '#D06060'
}

function RecipeCard({
  recipe, lang, darkMode, stock,
  isFavorite, onToggleFavorite, onOpen,
  allergenPrefs = [],
  onMarkAdminModifiedRead,
  onAddToCart, basketRecipeIds,
  rating = null,
  t,
}) {
  const { recipeNames: RECIPE_NAMES, recipesById } = useBaseRecipes()
  const countries      = useCountries()
  const dietTypes      = useDietTypes()
  const allergenTypes  = useAllergenTypes()
  const ingredientsById = useIngredientsById()

  const name    = recipe.isCustom ? (recipe.name ?? '') : (RECIPE_NAMES[recipe.id]?.[lang] ?? recipe.id)
  const country = recipe.country
  const diets   = (recipe.diet ?? []).filter(d => !HIDDEN_DIETS.includes(d))
  const pct     = Math.round(recipe.matchPercent * 100)
  const bar     = matchColor(pct)
  const cost    = calcRecipeCost(recipe, lang, 1, ingredientsById)
  const costStr = formatPrice(cost, lang)
  const derivedAllergens = useMemo(() => deriveRecipeAllergens(recipe, ingredientsById, recipesById), [recipe, ingredientsById, recipesById])
  const hasAllergen      = allergenPrefs.some(a => derivedAllergens.includes(a))
  const { visible: shownAllergens, overflow: allergenOverflow } = pickCardAllergens(derivedAllergens, allergenPrefs)
  const isInCart     = basketRecipeIds?.has(recipe.id) ?? false
  const allInFridge      = pct === 100 && !isInCart
  const [cartExpanded, setCartExpanded] = useState(false)
  const [cartNotice, setCartNotice]     = useState(null) // 'added' | 'duplicate' | 'all_in_fridge'
  const cartNoticeRef                   = useRef(null)
  const [upgradeCartOpen, setUpgradeCartOpen] = useState(false)
  const { hasPremiumAccess } = useSubscription()
  const { openUpgradeModal } = useUpgradeModal()
  const { user } = useAuth()
  const windowWidth = useWindowWidth()
  const isMobile = windowWidth < 640

  // Non-premium connecté : affiche "Premium" sur hover au lieu du prix
  const showCostOnHover    = !!(costStr && !isInCart && !allInFridge && hasPremiumAccess)
  const showPremiumOnHover = !hasPremiumAccess && !!user && !isInCart && !allInFridge
  const expandOnHover      = showCostOnHover || showPremiumOnHover || isInCart || allInFridge

  function showNotice(type) {
    setCartNotice(type)
    clearTimeout(cartNoticeRef.current)
    cartNoticeRef.current = setTimeout(() => setCartNotice(null), 2500)
  }

  function handleOpen() {
    onOpen(recipe)
    if (recipe.admin_modified && !recipe._isCommunity) onMarkAdminModifiedRead?.(recipe.id)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      data-recipe-id={recipe.id}
      onClick={handleOpen}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleOpen()}
      className="w-full text-left rounded-2xl cursor-pointer transition-all duration-150 hover:shadow-lg"
      style={{
        padding: '14px 16px',
        background: 'var(--card-bg)',
        boxShadow: darkMode ? '0 3px 16px rgba(0,0,0,0.50)' : '0 2px 10px rgba(0,0,0,0.07)',
        border: darkMode ? '1px solid #304D6E' : 'none',
        position: 'relative',
        // Perf du panneau (v0.133 : chaque carte porte désormais une image).
        // La pagination monte jusqu'à `filtered.length` cartes dans le DOM :
        // sans containment, CHAQUE frame de scroll paie le layout/paint de
        // toutes les cartes montées. `content-visibility: auto` fait sauter le
        // rendu des cartes hors écran ; le `auto` d'intrinsic-size mémorise la
        // vraie hauteur après premier rendu (190px = estimation initiale,
        // évite les sauts d'ascenseur).
        contentVisibility: 'auto',
        containIntrinsicSize: 'auto 190px',
      }}
    >
      {/* Ligne 1 : emoji + nom + drapeau + badges + favori + % */}
      <div className="flex items-center gap-3">
        <Emoji char={recipe.emoji} size={36} style={{ flexShrink: 0 }} imageUrl={recipe.image_url} />

        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span
            className="font-bold"
            style={{
              fontSize: '18px', color: 'var(--color-charcoal)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {name}
          </span>
          {country && countries[country] && (
            <Emoji char={countries[country].flag} size={18} style={{ flexShrink: 0 }} />
          )}
          {/* Hotfix v3.408 — source badge (Communauté vs Authentique).
              Affiché à côté du drapeau pour cohérence visuelle.
              Communauté = recette validée par l'admin ET publique,
              que ce soit la mienne ou celle d'un autre user.
              _isCommunity (custom publié par d'autres) OU is_public+approved
              (la mienne, validée). */}
          {(recipe._isCommunity || (recipe.is_public && recipe.moderation_status === 'approved')) && !recipe.promoted_from_id && (
            <RecipeSourceBadge variant="community" lang={lang} />
          )}
          {recipe.promoted_from_id && <RecipeSourceBadge variant="authentic" lang={lang} />}
        </div>

        {/* Colonne droite : badges + actions
            v3.196.0 — Refonte responsive (PR 8.7.d) : sur mobile, le
            badge note ⭐ est déplacé dans la ligne métadonnées (à côté
            de ⏱ et 👥) pour libérer de la place dans le header dense.
            Badge % compacté. Cart sans expand-on-hover (touch-only). */}
        <div className="flex items-start gap-1.5 shrink-0">
          {/* Badge note — desktop uniquement (mobile : dans ligne métadonnées) */}
          {rating?.count > 0 && !isMobile && (
            <span
              className="text-sm font-extrabold px-2.5 py-1 rounded-lg"
              style={{
                background: darkMode ? 'rgba(212,160,23,0.18)' : 'rgba(212,160,23,0.11)',
                color: '#C4930A',
                border: '1.5px solid rgba(212,160,23,0.28)',
              }}
            >
              ⭐ {rating.avg}
            </span>
          )}

          {/* Badge % */}
          <span
            className="font-extrabold rounded-lg"
            style={{
              fontSize: isMobile ? '12px' : '14px',
              padding: isMobile ? '3px 7px' : '4px 10px',
              background: pct === 100
                ? (darkMode ? 'rgba(76,175,125,0.18)' : 'rgba(76,175,125,0.13)')
                : (darkMode ? 'rgba(224,120,32,0.18)' : 'rgba(224,120,32,0.10)'),
              color: bar,
              border: `1.5px solid ${bar}40`,
            }}
          >
            {pct}%
          </span>

          {/* Favori (gauche) + Panier (droite, connecté uniquement) */}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '4px' }}>
            {/* Favori */}
            <Button
              variant="ghost"
              size="icon"
              onClick={e => { e.stopPropagation(); onToggleFavorite?.(recipe.id) }}
              title={isFavorite ? t.removeFav : t.addFav}
              aria-label={isFavorite ? t.removeFav : t.addFav}
              aria-pressed={isFavorite}
              className="h-auto w-auto p-0.5 leading-none hover:bg-transparent"
              style={{
                color: isFavorite ? '#E05878' : '#C4A555',
                opacity: isFavorite ? 1 : 0.5,
                transition: 'opacity 0.15s, transform 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.2)' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = isFavorite ? '1' : '0.5'; e.currentTarget.style.transform = 'scale(1)' }}
            >
              <LuHeart size={22} fill={isFavorite ? 'currentColor' : 'none'} strokeWidth={2} />
            </Button>

            {/* Panier — masqué si non connecté */}
            {user && onAddToCart && (
              <Button
                onClick={e => {
                  e.stopPropagation()
                  if (!hasPremiumAccess) { setUpgradeCartOpen(true); return }
                  if (allInFridge) { showNotice('all_in_fridge'); return }
                  if (isInCart)    { showNotice('duplicate');     return }
                  onAddToCart(recipe, recipe.servings ?? 1)
                  showNotice('added')
                }}
                title={isInCart ? t.alreadyInCart : allInFridge ? t.cartAllInFridge : t.addToCart}
                aria-label={isInCart ? t.alreadyInCart : allInFridge ? t.cartAllInFridge : t.addToCart}
                onMouseEnter={isMobile ? undefined : e => {
                  if (expandOnHover) {
                    setCartExpanded(true)
                    e.currentTarget.style.background = isInCart
                      ? '#3A9A6A'
                      : allInFridge
                        ? (darkMode ? '#2A3A4A' : '#9AA8B0')
                        : '#C05A10'
                  } else {
                    e.currentTarget.style.transform = 'scale(1.12)'
                    e.currentTarget.style.background = '#C05A10'
                  }
                }}
                onMouseLeave={isMobile ? undefined : e => {
                  setCartExpanded(false)
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.background = isInCart ? '#4CAF7D' : allInFridge ? (darkMode ? '#3A4A5A' : '#B0B8C1') : 'var(--color-brand-500)'
                }}
                className="rounded-md text-white"
                style={{
                  height: '28px',
                  minWidth: '28px',
                  // Sur mobile, taille fixe 28x28 (pas d'expand
                  // car pas de hover en touch). L'utilisateur découvre les
                  // statuts (in-cart, all-in-fridge) via le badge % et
                  // l'icône cart elle-même (couleur).
                  width: (!isMobile && expandOnHover && cartExpanded) ? 'auto' : '28px',
                  flexShrink: 0,
                  padding: (!isMobile && expandOnHover && cartExpanded) ? '0 10px 0 8px' : '0',
                  gap: (!isMobile && expandOnHover && cartExpanded) ? '5px' : '0',
                  overflow: 'hidden',
                  background: isInCart ? '#4CAF7D' : allInFridge ? (darkMode ? '#3A4A5A' : '#B0B8C1') : 'var(--color-brand-500)',
                  lineHeight: 1,
                  boxShadow: isInCart ? '0 2px 8px rgba(76,175,125,0.35)' : allInFridge ? 'none' : '0 2px 8px rgba(224,120,32,0.35)',
                  transition: 'width 0.18s ease, padding 0.18s ease, border-radius 0.18s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {!isMobile && showPremiumOnHover && cartExpanded && (
                  <span style={{ fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>⭐ Premium</span>
                )}
                {!isMobile && showCostOnHover && cartExpanded && (
                  <span style={{ fontSize: '12px', fontWeight: 800, whiteSpace: 'nowrap' }}>{costStr}</span>
                )}
                {!isMobile && isInCart && cartExpanded && (
                  <span style={{ fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>{t.cartBtnInCart}</span>
                )}
                {!isMobile && allInFridge && cartExpanded && (
                  <span style={{ fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>{t.cartBtnInFridge}</span>
                )}
                <LuShoppingCart size={15} strokeWidth={2.5} />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Badges statut (communauté / custom / modération / admin) */}
      {(recipe._isCommunity || recipe.isCustom || hasAllergen) && (
        <div className="flex flex-wrap gap-1.5 mt-2 ml-12">
          {recipe._isCommunity && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-md"
              style={{ background: darkMode ? 'rgba(99,179,237,0.15)' : '#EBF4FF', color: darkMode ? '#63B3ED' : '#2B6CB0', border: `1px solid ${darkMode ? 'rgba(99,179,237,0.25)' : '#63B3ED30'}` }}>
              👥 {t.communityRecipe}
            </span>
          )}
          {recipe.isCustom && !recipe._isCommunity && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-md"
              style={{ background: darkMode ? 'rgba(123,176,120,0.18)' : '#EDF7ED', color: darkMode ? '#7BB078' : '#4A8A48', border: `1px solid ${darkMode ? 'rgba(123,176,120,0.28)' : '#7BB07830'}` }}>
              {t.myRecipes}
            </span>
          )}
          {recipe.isCustom && !recipe._isCommunity && recipe.moderation_status === 'pending'  && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(251,191,36,0.15)', color: 'var(--color-warning)' }}>
              ⏳ {t.statusPending}
            </span>
          )}
          {recipe.isCustom && !recipe._isCommunity && recipe.moderation_status === 'approved' && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--color-success)' }}>
              ✓ {t.statusApproved}
            </span>
          )}
          {recipe.isCustom && !recipe._isCommunity && recipe.moderation_status === 'rejected' && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)' }}>
              ✗ {t.statusRejected}
            </span>
          )}
          {recipe.isCustom && !recipe._isCommunity && recipe.admin_modified && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(168,85,247,0.12)', color: '#9333EA', border: '1px solid rgba(168,85,247,0.25)' }}>
              ✏️ {t.adminModified}
            </span>
          )}
          {hasAllergen && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-md"
              style={{
                background: darkMode ? 'rgba(220,38,38,0.20)' : 'rgba(220,38,38,0.10)',
                color: darkMode ? '#FCA5A5' : '#B91C1C',
                border: `1px solid ${darkMode ? 'rgba(220,38,38,0.40)' : 'rgba(220,38,38,0.25)'}`,
              }}>
              ⚠️ {t.allergenAlert}
            </span>
          )}
        </div>
      )}

      {/* Ligne métadonnées : temps / couverts / [note mobile] / régimes
          v3.196.0 — Note ⭐ déplacée ici sur mobile (libère le header dense). */}
      <div className="flex flex-wrap items-center gap-2 mt-2.5 ml-12">
        <span className="text-sm font-medium" style={{ color: 'var(--color-muted)' }}>⏱ {recipe.time}</span>
        <span className="text-sm opacity-40" style={{ color: 'var(--color-muted)' }}>·</span>
        <span className="text-sm font-medium" style={{ color: 'var(--color-muted)' }}>👥 {recipe.servings}</span>
        {isMobile && rating?.count > 0 && (
          <>
            <span className="text-sm opacity-40" style={{ color: 'var(--color-muted)' }}>·</span>
            <span className="text-sm font-bold" style={{ color: '#C4930A' }}>
              ⭐ {rating.avg}
            </span>
          </>
        )}
        {diets.slice(0, 2).map(key => dietTypes[key] ? (
          <span
            key={key}
            className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0"
            style={{ background: dietTypes[key].bg_color, color: dietTypes[key].color }}
          >
            {dietTypes[key]?.labels?.[lang] ?? key}
          </span>
        ) : null)}
      </div>

      {/* Chips allergènes — dérivés des ingrédients (= modal), allergènes du profil
          toujours visibles et en tête (sécurité : jamais masqués par le cap). */}
      {derivedAllergens.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mt-1.5 ml-12">
          {shownAllergens.map(key => {
            const info    = allergenTypes[key]
            const isMatch = allergenPrefs.includes(key)
            return (
              <span
                key={key}
                title={info?.labels?.[lang] ?? key}
                className="text-xs py-0.5 px-2 rounded-md shrink-0"
                style={{
                  fontWeight: isMatch ? 700 : 500,
                  background: isMatch
                    ? (darkMode ? 'rgba(220,38,38,0.20)' : 'rgba(220,38,38,0.10)')
                    : (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                  color: isMatch
                    ? (darkMode ? '#FCA5A5' : '#B91C1C')
                    : (darkMode ? 'rgba(255,255,255,0.55)' : 'var(--color-muted)'),
                  border: `1px solid ${isMatch
                    ? (darkMode ? 'rgba(220,38,38,0.35)' : 'rgba(220,38,38,0.20)')
                    : (darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)')}`,
                }}
              >
                {info?.icon ?? ''} {info?.labels?.[lang] ?? key}
              </span>
            )
          })}
          {allergenOverflow > 0 && (
            <span className="text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>
              +{allergenOverflow}
            </span>
          )}
        </div>
      )}

      {/* Chips ingrédients requis : présents (vert) + manquants (rouge) — deux lignes séparées */}
      {(() => {
        const { present, missing } = splitPresentMissing(recipe, stock)
        if (present.length === 0 && missing.length === 0) return null

        // Sélectionne les chips à afficher selon un budget de caractères (pas de clip CSS)
        function pickChips(items) {
          const BUDGET = 35
          const MAX    = 4
          const visible = []
          let chars = 0
          for (const ing of items) {
            if (visible.length >= MAX) break
            const label = ing.labels?.[lang] ?? ing.label ?? ''
            if (visible.length === 0 || chars + label.length <= BUDGET) {
              visible.push(ing)
              chars += label.length
            } else {
              break
            }
          }
          return { visible, overflow: items.length - visible.length }
        }

        const greenStyle = { background: '#7BB07820', color: darkMode ? '#7BB078' : '#4A7A48', border: '1px solid #7BB07830' }
        const redStyle   = { background: darkMode ? 'rgba(220,38,38,0.18)' : 'rgba(220,38,38,0.10)', color: darkMode ? '#FCA5A5' : '#B91C1C', border: `1px solid ${darkMode ? 'rgba(220,38,38,0.35)' : 'rgba(220,38,38,0.22)'}` }
        const chip  = 'text-sm font-semibold px-2.5 py-0.5 rounded-md shrink-0'
        const badge = 'text-sm font-semibold px-2.5 py-0.5 rounded-md shrink-0'

        const { visible: visPresent, overflow: ovPresent } = pickChips(present)
        const { visible: visMissing, overflow: ovMissing } = pickChips(missing)

        return (
          <>
            {present.length > 0 && (
              <div className="flex items-center gap-1 mt-2 ml-12 flex-wrap">
                {visPresent.map((ing, i) => (
                  <span key={i} className={chip} style={greenStyle}>✓ {ing.labels?.[lang] ?? ing.label ?? ''}</span>
                ))}
                {ovPresent > 0 && <span className={badge} style={greenStyle}>+{ovPresent}</span>}
              </div>
            )}
            {missing.length > 0 && (
              <div className="flex items-center gap-1 mt-1 ml-12 flex-wrap">
                {visMissing.map((ing, i) => (
                  <span key={i} className={chip} style={redStyle}>{ing.labels?.[lang] ?? ing.label ?? ''}</span>
                ))}
                {ovMissing > 0 && <span className={badge} style={redStyle}>+{ovMissing}</span>}
              </div>
            )}
          </>
        )
      })()}

      {/* Barre de match */}
      <div className="mt-2 ml-12">
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: darkMode ? '#243650' : '#E8D9C0' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: bar,
              boxShadow: pct === 100 ? '0 0 8px rgba(76,175,125,0.55)' : 'none',
            }}
          />
        </div>
      </div>

      {/* Notice panier */}
      {cartNotice && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', inset: 0, borderRadius: '16px',
            background: darkMode ? 'rgba(0,0,0,0.68)' : 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <div style={{
            background: cartNotice === 'added' ? '#4CAF7D' : (darkMode ? '#1E2D3D' : 'white'),
            color: cartNotice === 'added' ? 'white' : (darkMode ? 'rgba(255,255,255,0.90)' : '#333'),
            border: cartNotice === 'added' ? 'none' : `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}`,
            padding: '10px 20px', borderRadius: '10px',
            fontSize: '14px', fontWeight: 700,
            boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
            textAlign: 'center',
          }}>
            {cartNotice === 'added' ? `✓ ${t.cartAdded}` : cartNotice === 'duplicate' ? t.alreadyInCart : t.cartAllInFridge}
          </div>
        </div>
      )}

      {upgradeCartOpen && createPortal(
        <div
          onClick={() => setUpgradeCartOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '360px', width: '100%' }}>
            <UpgradeGate
              feature="basket"
              variant="hard"
              lang={lang}
              darkMode={darkMode}
              onUpgradeClick={() => { setUpgradeCartOpen(false); openUpgradeModal() }}
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

export default memo(RecipeCard)
