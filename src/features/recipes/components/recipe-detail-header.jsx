// Header du mode « détail » de RecipeModal (titre, drapeau, note, boutons
// d'action, description, méta temps/difficulté/portions, badges régime,
// barre de match), extrait de recipe-modal.jsx le 2026-07-27 (audit front
// §2, suite du découpage — task 4/4, dernier gros bloc).
//
// Présentationnel : tout l'état (flagHovered, cartHeaderNotice,
// showDeleteConfirm, shareOpen, selectedServings, reviewsAgg, activeTab…)
// reste dans RecipeModal, qui pilote toujours le flux détail ↔ retrait.
//
// isPage (dérivé de `variant === 'page'` de RecipeModal) ramifie DANS ce
// composant : niveau du titre (h1 en page, h2 en modale), tabIndex, affordance
// « Toutes les recettes ». Couvert par `recipe-titre-niveau.test.jsx`.
//
// Props nommées à l'identique des identifiants utilisés dans le JSX
// ci-dessous : aucune substitution d'identifiant dans le corps,
// déplacement byte-identique (dédent uniforme du bloc source).

import { Link } from 'react-router-dom'
import { LuHeart, LuPencil, LuTrash2, LuStar, LuShoppingCart, LuShare2, LuLock, LuLayoutList } from 'react-icons/lu'
import Emoji from '@shared/ui/emoji'
import RecipeSourceBadge from '@shared/ui/recipe-source-badge'
import { TYPE_COLORS, DIFFICULTY_COLOR, DIFFICULTY_TEXT, DIFFICULTY_TEXT_DARK } from '@shared/static/recipe-constants'
import InfoTooltip from '@shared/ui/info-tooltip'
import Tooltip from '@shared/ui/tooltip'
import Button from '@shared/ui/button'

export function RecipeDetailHeader({
  recipe,
  recipeName,
  isPage,
  theme,
  headerText,
  pct,
  darkMode,
  isMobile,
  lang,
  t,
  favorites,
  onToggleFavorite,
  onAllRecipes,
  onClose,
  onEditRecipe,
  onAddToCart,
  hasPremiumAccess,
  isAdmin,
  canEditRecipe,
  isApprovedCommunity,
  isInCart,
  allInFridge,
  cartHeaderNotice,
  setCartHeaderNotice,
  cartHeaderNoticeRef,
  selectedServings,
  setSelectedServings,
  servingsLocked,
  minServings,
  lockedByLabel,
  lockedOriginServings,
  reviewsAgg,
  setActiveTab,
  setShareOpen,
  setShowDeleteConfirm,
  titleRef,
  flagHovered,
  setFlagHovered,
  countryInfo,
  dietTypes,
  recipeDescription,
  recipeDiets,
  condensed,
  collapseStyle,
  barColor, barTextColor,
  matchCount,
  required,
}) {
  const Titre = isPage ? 'h1' : 'h2'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Ligne 1 : (emoji desktop) + nom + drapeau + note + boutons
          v3.193.0 — Sur mobile : emoji retiré (gain de place,
          l'emoji est déjà visible dans la card de la liste +
          le drapeau du pays reste à côté du titre). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '14px' }}>
        {!isMobile && (
          <Emoji char={recipe.emoji} size={60} style={{ flexShrink: 0 }} imageUrl={recipe.image_url} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Titre
              ref={titleRef}
              tabIndex={isPage ? -1 : undefined}
              style={{
                fontSize: isMobile ? '20px' : '28px',
                fontWeight: 800, lineHeight: 1.2,
                color: headerText, margin: 0, minWidth: 0,
                outline: 'none',
              }}>
              {recipeName}
            </Titre>
            {/* Hotfix v3.408 — source badge (Communauté vs Authentique)
                à côté du drapeau pour cohérence visuelle avec RecipeCard.
                Voir recipe-card.jsx pour le rationale du check. */}
            {(recipe._isCommunity || (recipe.is_public && recipe.moderation_status === 'approved')) && !recipe.promoted_from_id && (
              <RecipeSourceBadge variant="community" lang={lang} size="lg" />
            )}
            {recipe.promoted_from_id && <RecipeSourceBadge variant="authentic" lang={lang} size="lg" />}
            {countryInfo && (
              <span style={{ position: 'relative', display: condensed ? 'none' : 'inline-flex', alignItems: 'center', cursor: 'default' }}
                onMouseEnter={() => setFlagHovered(true)} onMouseLeave={() => setFlagHovered(false)}>
                <Emoji char={countryInfo.flag} size={28} />
                <span style={{
                  position: 'absolute', left: '50%', bottom: 'calc(100% + 6px)',
                  transform: `translateX(-50%) translateY(${flagHovered ? 0 : 4}px)`,
                  background: darkMode ? '#0F1923' : '#FDFAF6',
                  color: darkMode ? '#F5DEB8' : 'var(--color-charcoal)',
                  border: '1px solid #E07820', borderRadius: '6px', padding: '3px 8px',
                  fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
                  boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.15)',
                  pointerEvents: 'none', opacity: flagHovered ? 1 : 0,
                  transition: 'opacity 0.15s, transform 0.15s', zIndex: 10,
                }}>
                  {countryInfo.names[lang] ?? countryInfo.names.fr}
                </span>
              </span>
            )}
            {/* Badge note — à côté du drapeau */}
            {reviewsAgg.count > 0 && (
              <Button
                onClick={() => setActiveTab('reviews')}
                type="button"
                title={t.reviewsBadgeTitle(reviewsAgg.avg, reviewsAgg.count)}
                className="h-[26px] shrink-0 rounded-[7px] px-2 text-xs font-extrabold"
                style={{
                  gap: '4px',
                  background: darkMode ? 'rgba(212,160,23,0.18)' : 'rgba(212,160,23,0.12)',
                  color: '#C4930A',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = darkMode ? 'rgba(212,160,23,0.28)' : 'rgba(212,160,23,0.22)'}
                onMouseLeave={e => e.currentTarget.style.background = darkMode ? 'rgba(212,160,23,0.18)' : 'rgba(212,160,23,0.12)'}
              >
                <LuStar size={12} fill="currentColor" />
                <span>{reviewsAgg.avg}</span>
                <span style={{ opacity: 0.65, fontWeight: 600, fontSize: '11px' }}>({reviewsAgg.count})</span>
              </Button>
            )}
          </div>
        </div>

        {/* Boutons actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>

          {/* Affordance « Toutes les recettes » — retour au panneau.
              Via onAllRecipes (useSmartBack) : navigate(-1) quand on
              vient d'une navigation interne → restaure filtres
              (URL-synced) + scroll (sessionStorage) ; fallback
              /?recettes=1 en deep-link direct. Si la prop n'est pas
              fournie, on retombe sur un Link simple vers le panneau. */}
          {isPage && (() => {
            const allRecipesLabel = t.allRecipes
            const allRecipesStyle = {
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              gap: isMobile ? 0 : '6px',
              padding: isMobile ? '0 10px' : '0 12px',
              height: '36px', minWidth: isMobile ? '40px' : undefined,
              borderRadius: '8px',
              fontSize: '13px', fontWeight: 700,
              background: darkMode ? '#243650' : '#F5EDE0',
              color: darkMode ? '#F5DEB8' : 'var(--color-charcoal)',
              textDecoration: 'none', cursor: 'pointer',
              border: `1px solid ${darkMode ? '#3A4A5A' : 'var(--color-border-warm)'}`,
              whiteSpace: 'nowrap', transition: 'background 0.15s',
              fontFamily: 'inherit',
            }
            const onEnter = e => e.currentTarget.style.background = darkMode ? '#2A4060' : '#EBE2D2'
            const onLeave = e => e.currentTarget.style.background = darkMode ? '#243650' : '#F5EDE0'
            const inner = (
              <>
                <LuLayoutList size={14} strokeWidth={2.4} style={{ flexShrink: 0 }} />
                {!isMobile && allRecipesLabel}
              </>
            )
            return onAllRecipes ? (
              <button type="button" onClick={onAllRecipes} title={allRecipesLabel} aria-label={allRecipesLabel}
                style={allRecipesStyle} onMouseEnter={onEnter} onMouseLeave={onLeave}>
                {inner}
              </button>
            ) : (
              <Link to="/?recettes=1" title={allRecipesLabel} aria-label={allRecipesLabel}
                style={allRecipesStyle} onMouseEnter={onEnter} onMouseLeave={onLeave}>
                {inner}
              </Link>
            )
          })()}

          {/* Bouton panier header — réservé Premium.
              v3.194.0 — Refonte UX (PR 8.7.c) : label fixe au
              lieu d'expand-on-hover qui cachait le sens. Sur
              mobile : icône seule (gain de place dans le header). */}
          {onAddToCart && hasPremiumAccess && (
            <div style={{ position: 'relative' }}>
            <Button
              onClick={() => {
                if (allInFridge) {
                  setCartHeaderNotice('all_in_fridge')
                  clearTimeout(cartHeaderNoticeRef.current)
                  cartHeaderNoticeRef.current = setTimeout(() => setCartHeaderNotice(null), 3000)
                  return
                }
                if (isInCart) {
                  setCartHeaderNotice('duplicate')
                  clearTimeout(cartHeaderNoticeRef.current)
                  cartHeaderNoticeRef.current = setTimeout(() => setCartHeaderNotice(null), 3000)
                  return
                }
                onAddToCart?.(recipe, selectedServings)
                setCartHeaderNotice('added')
                clearTimeout(cartHeaderNoticeRef.current)
                cartHeaderNoticeRef.current = setTimeout(() => setCartHeaderNotice(null), 3000)
              }}
              title={isInCart ? t.alreadyInCart : allInFridge ? t.cartAllInFridge : t.addToCart}
              aria-label={isInCart ? t.alreadyInCart : allInFridge ? t.cartAllInFridge : t.addToCart}
              className="h-8 rounded-lg px-3 text-[13px] font-bold text-white"
              style={{
                gap: isMobile ? 0 : '6px',
                padding: isMobile ? '0 8px' : '0 12px',
                background: isInCart ? '#4CAF7D' : allInFridge ? (darkMode ? '#3A4A5A' : '#B0B8C1') : 'var(--color-brand-500)',
                boxShadow: isInCart
                  ? '0 2px 8px rgba(76,175,125,0.40)'
                  : allInFridge
                    ? 'none'
                    : '0 2px 8px rgba(224,120,32,0.40)',
                transition: 'background 0.2s',
              }}
            >
              <LuShoppingCart size={16} strokeWidth={2.5} style={{ flexShrink: 0 }} />
              {!isMobile && (
                <span style={{ whiteSpace: 'nowrap' }}>{t.addToCart}</span>
              )}
            </Button>

            {/* Mini-modale notice panier */}
            {cartHeaderNotice && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                background: cartHeaderNotice === 'added' ? '#4CAF7D' : (darkMode ? '#1E2D3D' : 'white'),
                color: cartHeaderNotice === 'added' ? 'white' : (darkMode ? 'rgba(255,255,255,0.90)' : '#333'),
                border: cartHeaderNotice === 'added' ? 'none' : `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}`,
                padding: '10px 16px',
                borderRadius: '10px',
                fontSize: '13px', fontWeight: 700,
                boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
                whiteSpace: 'nowrap',
                zIndex: 50,
                animation: 'menu-slide-down 0.18s ease both',
              }}>
                {cartHeaderNotice === 'added' && '✓ '}{cartHeaderNotice === 'added' ? t.cartAdded : cartHeaderNotice === 'duplicate' ? t.alreadyInCart : t.cartAllInFridge}
              </div>
            )}
            </div>
          )}

          <Tooltip text={favorites.has(recipe.id) ? t.removeFav : t.addFav} darkMode={darkMode}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleFavorite?.(recipe.id)}
            aria-label={favorites.has(recipe.id) ? t.removeFav : t.addFav}
            aria-pressed={favorites.has(recipe.id)}
            className="h-auto w-auto p-1 leading-none hover:bg-transparent"
            style={{
              color: '#E05878',
              opacity: favorites.has(recipe.id) ? 1 : 0.35,
              transition: 'opacity 0.2s, transform 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.15)' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = favorites.has(recipe.id) ? '1' : '0.35'; e.currentTarget.style.transform = 'scale(1)' }}
          >
            <LuHeart size={22} fill={favorites.has(recipe.id) ? 'currentColor' : 'none'} strokeWidth={2.5} />
          </Button>
          </Tooltip>

          {/* Bouton « Partager » : ouvre la feuille (lien public + QR +
              impression de la fiche technique). Toujours visible —
              l'impression y reste disponible même pour les recettes
              privées (le lien/QR sont masqués selon isPubliclyShareable). */}
          <Tooltip text={t.shareRecipe ?? 'Partager la recette'} darkMode={darkMode}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShareOpen(true)}
            aria-label={t.shareRecipe ?? 'Partager la recette'}
            className="h-auto w-auto p-1 leading-none hover:bg-transparent"
            style={{
              color: headerText, opacity: 0.45,
              transition: 'opacity 0.2s, transform 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.15)' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '0.45'; e.currentTarget.style.transform = 'scale(1)' }}
          >
            <LuShare2 size={20} strokeWidth={2} />
          </Button>
          </Tooltip>

          {/* Edit : caché si recette communauté validée (admin only) */}
          {canEditRecipe && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEditRecipe?.(recipe)}
              title={t.editRecipe}
              aria-label={t.editRecipe}
              className="h-auto w-auto p-1 leading-none hover:bg-transparent"
              style={{ color: headerText, opacity: 0.45, transition: 'opacity 0.2s, transform 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.15)' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '0.45'; e.currentTarget.style.transform = 'scale(1)' }}
            >
              <LuPencil size={20} strokeWidth={2} />
            </Button>
          )}
          {/* Indicateur visuel verrou pour l'auteur d'une recette validée
              (sans bouton edit). Tooltip explique pourquoi. */}
          {recipe.isCustom && isApprovedCommunity && !isAdmin && (
            <span
              title={t.lockedTooltip}
              aria-label={t.lockedRecipe}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '11px', fontWeight: 700,
                padding: '4px 8px', borderRadius: '6px',
                color: headerText, opacity: 0.55,
                background: 'rgba(120,120,120,0.10)',
              }}
            >
              <LuLock size={12} strokeWidth={2.5} />
              {t.lockedBadge}
            </span>
          )}
          {/* Delete : toujours accessible à l'auteur (droit RGPD Art. 17),
              même sur recette approved. Hard-delete via RPC dédiée. */}
          {recipe.isCustom && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDeleteConfirm(true)}
              title={t.deleteRecipe}
              aria-label={t.deleteRecipe}
              className="h-auto w-auto p-1 leading-none hover:bg-transparent"
              style={{ color: '#D06060', opacity: 0.55, transition: 'opacity 0.2s, transform 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.15)' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '0.55'; e.currentTarget.style.transform = 'scale(1)' }}
            >
              <LuTrash2 size={20} strokeWidth={2} />
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={onClose}
            aria-label={t.close}
            className="close-x h-auto rounded-none p-1 text-xl leading-none hover:bg-transparent"
            style={{ color: headerText, opacity: 0.35, transition: 'opacity 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.35'}
          >✕</Button>
        </div>
      </div>

      {/* Descriptif court de la recette (sous le titre, aligné sur la méta).
          Se replie quand le header est condensé (mobile, au scroll). */}
      {recipeDescription && (
        <div style={collapseStyle}>
          <p style={{
            margin: 0,
            paddingLeft: isMobile ? 0 : '78px',
            fontSize: isMobile ? '14px' : '15px',
            lineHeight: 1.45,
            color: darkMode ? 'rgba(255,255,255,0.78)' : 'var(--color-muted)',
          }}>
            {recipeDescription}
          </p>
        </div>
      )}

      {/* Ligne 2 : métadonnées
          v3.194.0 — Refonte UX (PR 8.7.c) : 2 sous-rangées
          pour aérer. Rangée 2a = primary infos (temps,
          difficulté, stepper portions explicite). Rangée 2b
          = badges secondaires (type + régimes), wrap. */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '8px',
        paddingLeft: isMobile ? 0 : '78px',
      }}>
        {/* Rangée 2a : temps · difficulté · stepper portions
            Temps + difficulté masqués eux aussi quand condensé
            (retour utilisateur 2026-07-10 : gagner encore plus de
            place à l'écran pendant la lecture des étapes). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', rowGap: '6px' }}>
          <span style={{
            display: condensed ? 'none' : 'inline-flex', alignItems: 'center', gap: '5px',
            fontSize: '14px', fontWeight: 600,
            color: darkMode ? 'rgba(255,255,255,0.75)' : 'var(--color-muted)',
          }}>
            ⏱ {recipe.time}
          </span>
          <span style={{
            display: condensed ? 'none' : 'inline-flex', alignItems: 'center',
            fontSize: '13px', fontWeight: 700,
            padding: '4px 11px', borderRadius: '7px',
            background: (DIFFICULTY_COLOR[recipe.difficulty] ?? '#999') + '22',
            color: (darkMode ? DIFFICULTY_TEXT_DARK : DIFFICULTY_TEXT)[recipe.difficulty] ?? (darkMode ? '#AAA' : '#666'),
          }}>
            {t.difficultyMap[recipe.difficulty] ?? recipe.difficulty}
          </span>
          {/* Bandeau texte verrouillage (aperçu recette de base en contexte) —
              toujours visible (pas une tooltip, inutilisable au tap mobile),
              remplace le libellé et désactive le stepper. Voir
              la conception « base-recipe-servings-lock » du 2026-07-15 */}
          {servingsLocked && !condensed && (
            <div style={{
              fontSize: '12px', fontWeight: 600, width: '100%',
              color: darkMode ? 'rgba(255,255,255,0.55)' : 'var(--color-muted)',
            }}>
              {t.lockedServingsLabel(lockedOriginServings, lockedByLabel)}
            </div>
          )}
          {/* Stepper portions — zone explicite « 👥 Pour [−] X pers [+] ».
              Masqué quand le header est condensé (mobile, au scroll). */}
          <span style={{
            display: condensed ? 'none' : 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '3px 10px', borderRadius: '999px',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)'}`,
            background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
          }}>
            <span style={{ fontSize: '13px', color: darkMode ? 'rgba(255,255,255,0.65)' : 'var(--color-muted)' }}>👥</span>
            <Button
              type="button"
              onClick={() => setSelectedServings(s => Math.max(minServings, s - 2))}
              disabled={servingsLocked || selectedServings <= minServings}
              aria-label={t.fewerServings}
              className="h-7 w-7 shrink-0 rounded-md p-0 text-[15px] font-extrabold leading-none disabled:opacity-100"
              style={{
                background: (servingsLocked || selectedServings <= minServings) ? 'transparent' : 'var(--color-brand-500)',
                color: (servingsLocked || selectedServings <= minServings) ? (darkMode ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.30)') : '#FFFFFF',
              }}
            >−</Button>
            <span style={{
              fontSize: '14px', fontWeight: 700,
              color: darkMode ? 'rgba(255,255,255,0.85)' : 'var(--color-charcoal)',
              minWidth: '52px', textAlign: 'center',
            }}>
              {servingsLocked ? '🔒' : t.servings(selectedServings)}
            </span>
            <Button
              type="button"
              onClick={() => setSelectedServings(s => Math.min(12, s === 1 ? 2 : s + 2))}
              disabled={servingsLocked || selectedServings >= 12}
              aria-label={t.moreServings}
              className="h-7 w-7 shrink-0 rounded-md p-0 text-[15px] font-extrabold leading-none disabled:opacity-100"
              style={{
                background: (servingsLocked || selectedServings >= 12) ? 'transparent' : 'var(--color-brand-500)',
                color: (servingsLocked || selectedServings >= 12) ? (darkMode ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.30)') : '#FFFFFF',
              }}
            >+</Button>
          </span>
        </div>

        {/* Rangée 2b : badges secondaires (type + régimes).
            Se replie quand le header est condensé (mobile, au scroll). */}
        {(recipe.type || recipeDiets.length > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', rowGap: '6px', ...collapseStyle }}>
            {recipe.type && TYPE_COLORS[recipe.type] && (
              <span style={{
                fontSize: '12px', fontWeight: 700,
                padding: '3px 9px', borderRadius: '6px',
                background: TYPE_COLORS[recipe.type].bg,
                color: TYPE_COLORS[recipe.type].text,
              }}>
                {t.typeMap?.[recipe.type] ?? recipe.type}
              </span>
            )}
            {recipeDiets.map(d => (
              <span key={`diet-${d}`} style={{
                fontSize: '12px', fontWeight: 700,
                padding: '3px 9px', borderRadius: '6px',
                background: dietTypes[d]?.bg_color,
                color: dietTypes[d]?.color,
              }}>
                {dietTypes[d]?.labels?.[lang] ?? d}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Ligne 3 : barre de match */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        paddingLeft: isMobile ? 0 : '78px',
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <div className="rounded-full overflow-hidden" style={{ height: '6px', background: darkMode ? 'rgba(255,255,255,0.12)' : `${theme.text}22` }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: '9999px', background: barColor, transition: 'width 0.5s ease', boxShadow: pct === 100 ? '0 0 8px rgba(76,175,125,0.55)' : 'none' }} />
          </div>
        </div>
        <span style={{
          fontSize: '14px', fontWeight: 700, flexShrink: 0,
          padding: '3px 11px', borderRadius: '6px',
          background: `${barColor}18`, color: barTextColor ?? barColor,
          border: `1px solid ${barColor}30`,
        }}>
          {pct}% — {t.matchCount(matchCount, required.length)}
        </span>
        <InfoTooltip text={t.matchInfo} darkMode={darkMode} />
      </div>

    </div>
  )
}
