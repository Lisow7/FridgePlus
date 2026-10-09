import { useId } from 'react'
import { LuArrowLeft, LuSearch, LuX, LuSun, LuMoon, LuScroll, LuFeather } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { getC } from './community-theme'

// En-tête de l'espace communauté — extrait de community-page.jsx (2026-07-26,
// audit front §2, dernier bloc). Retour, titre (ou libellé de la vue détail),
// bascule recherche, thème, charte et bouton de publication.
// Présentationnel : état et handlers arrivent en props depuis CommunityPage.
export function CPHeader({ view, onBack, onCompose, showSearch, setShowSearch, search, setSearch, canInteract, muteStatus, user, t, isMobile, darkMode, onToggleDarkMode, onShowCharter }) {
  const C = getC(darkMode)
  const champRechercheId = useId()
  return (
    <div style={{ flexShrink: 0, background: C.surface, borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: isMobile ? '12px 14px' : '14px 20px', minHeight: 56 }}>
        <Button variant="ghost" size="icon"
          onClick={onBack} aria-label={t.backToFeed}
          className="h-auto w-auto shrink-0 rounded-lg p-1.5 hover:bg-transparent"
          style={{ color: C.mid, transition: 'color .15s' }}
          onMouseEnter={e => e.currentTarget.style.color = C.orange}
          onMouseLeave={e => e.currentTarget.style.color = C.mid}>
          <LuArrowLeft size={20} />
        </Button>

        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {view === 'feed' ? (
            // `<h1>` et non `<span>` : c'est le titre de la page. En `<span>`,
            // `/community` n'avait AUCUN titre de premier niveau — un lecteur
            // d'écran ne pouvait pas annoncer où il se trouvait, et la page,
            // désormais pré-rendue et indexable, n'avait pas d'en-tête à offrir.
            //
            // `margin: 0` est indispensable : la marge par défaut d'un `<h1>`
            // décalerait la barre. Tout le reste du style est inchangé — le
            // rendu doit être identique au pixel près (QA visuelle faite).
            // 🔴 `maxWidth` + troncature : sans eux, ce titre DEBORDE.
            // Mesure du 2026-09-12 en 390 px : le conteneur ci-dessus tombe a
            // 87 px (il a bien retreci, `minWidth: 0` fait son travail) mais un
            // `inline-block` ne descend JAMAIS sous la largeur de son contenu —
            // le titre gardait ses 168 px et depassait de 81. Il finissait a
            // 222 px alors que le bloc de droite commence a 149 : **73 px de
            // recouvrement**, boutons et texte poses sur les lettres.
            //
            // Ce que la CI a vu et pas le poste du mainteneur : axe ne signale
            // `color-contrast` que sur du TEXTE, et sous Windows le titre
            // n'empietait que d'1 px sur « Connecte-toi pour publier ». Sous
            // Linux, ou la police mesure plus large, l'empietement devient franc
            // et axe rend « color-contrast (bgOverlap) » — il ne peut plus
            // calculer un contraste sur un texte pose sur un autre. Meme lecon
            // que la visite guidee le matin meme : **les polices de Linux ne
            // mesurent pas comme celles de Windows**, et une mise en page qui ne
            // tient que par la largeur d'une police ne tient pas.
            //
            // `inline-block` est CONSERVE a dessein : le degrade est clippe sur
            // le texte, et un `block` l'etirerait sur toute la rangee en
            // changeant les couleurs des lettres. Avec `maxWidth: 100%`, tant
            // que le titre tient le rendu est identique au pixel pres ; quand il
            // ne tient pas, il se coupe au lieu de recouvrir.
            <h1 style={{
              display: 'inline-block',
              maxWidth: '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              margin: 0,
              fontSize: isMobile ? '20px' : '24px',
              fontWeight: 900,
              letterSpacing: '0.08em',
              backgroundImage: `linear-gradient(90deg, ${C.orange}, ${C.cyan})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: 1.2,
            }}>
              {t.title.toUpperCase()}
            </h1>
          ) : (
            <span style={{ display: 'inline-block', fontSize: isMobile ? '16px' : '18px', fontWeight: 700, color: C.hi }}>
              {t.backToFeed}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {view === 'feed' && (
            <Button variant="ghost" size="icon"
              onClick={() => setShowSearch(s => !s)} aria-label={t.searchAria}
              aria-pressed={showSearch}
              className="h-auto w-auto rounded-lg border-[1.5px] p-1.5 hover:bg-transparent"
              style={{
                background: showSearch ? C.orangeDim : 'transparent',
                borderColor: showSearch ? C.orange : C.border,
                color: showSearch ? C.orange : C.mid,
                transition: 'all .15s',
              }}>
              {showSearch ? <LuX size={16} /> : <LuSearch size={16} />}
            </Button>
          )}

          {onToggleDarkMode && (
            <Button variant="ghost" size="icon"
              onClick={onToggleDarkMode}
              aria-label={darkMode ? t.themeLight : t.themeDark}
              title={darkMode ? t.themeLight : t.themeDark}
              className="h-auto w-auto rounded-lg border-[1.5px] bg-transparent p-1.5 hover:bg-transparent"
              style={{ borderColor: C.border, color: C.mid, transition: 'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.orange; e.currentTarget.style.color = C.orange }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.mid }}>
              {darkMode ? <LuSun size={16} /> : <LuMoon size={16} />}
            </Button>
          )}

          {/* v3.409 — bouton charte ré-introduit suite feedback user :
              utile pour relecture (mode readOnly si signée, normal sinon).
              Hotfix : size="icon" + p-1.5 + LuScroll size={16} → mêmes
              dimensions que les boutons search/dark mode adjacents. */}
          {onShowCharter && (
            <Button variant="ghost" size="icon"
              onClick={onShowCharter}
              aria-label={t.prefsCommunityTitle}
              title={t.prefsCommunityTitle}
              className="h-auto w-auto rounded-lg border-[1.5px] bg-transparent p-1.5 hover:bg-transparent"
              style={{ borderColor: C.border, color: C.mid, transition: 'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.orange; e.currentTarget.style.color = C.orange }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.mid }}>
              <LuScroll size={16} />
            </Button>
          )}

          {user?.id ? (
            <Button onClick={onCompose} disabled={!canInteract}
              title={!canInteract ? (muteStatus?.muted ? t.mutedBanner : t.termsDeclinedBanner) : t.newPostBtn}
              className="h-auto rounded-lg text-[15px] font-extrabold"
              style={{
                gap: '6px',
                padding: isMobile ? '7px 10px' : '8px 14px',
                background: !canInteract ? C.lo : `linear-gradient(135deg, ${C.orange}, ${darkMode ? '#FF9A00' : '#E07020'})`,
                color: !canInteract ? C.mid : (darkMode ? '#000' : '#fff'),
                boxShadow: !canInteract ? 'none' : `0 0 14px ${C.orangeDim}`,
                opacity: !canInteract ? 0.5 : 1,
                transition: 'all .15s',
              }}>
              <LuFeather size={15} />
              {!isMobile && t.newPostBtn}
            </Button>
          ) : (
            // Masque en mobile pour la MEME raison que le libelle du bouton
            // « Nouveau post » juste au-dessus (`{!isMobile && t.newPostBtn}`) :
            // 155 px de texte sur une rangee de 390 qui doit deja loger le
            // retour, le titre et trois boutons — 449 px demandes pour 390
            // offerts. C'est ce texte-la qui poussait le titre a se recouvrir.
            // L'information n'est pas perdue : `community-detail-view.jsx` la
            // reaffiche au moment ou elle compte, quand on tente de reagir.
            !isMobile && <span style={{ fontSize: '14px', color: C.mid, fontStyle: 'italic' }}>{t.loginToPost}</span>
          )}
        </div>
      </div>

      {showSearch && view === 'feed' && (
        <div style={{ padding: '0 14px 12px' }}>
          {/* Un libellé visible au-dessus du cadre (la loupe vit dedans). */}
          <label htmlFor={champRechercheId} style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: C.mid, marginBottom: '6px' }}>{t.searchInputAria}</label>
          <div style={{ position: 'relative' }}>
            <LuSearch size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: C.mid, pointerEvents: 'none' }} />
            <input
              id={champRechercheId}
              className="cp-input"
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.searchPh}
              style={{
                width: '100%', padding: '8px 10px 8px 32px',
                background: C.surface2, border: `1.5px solid ${C.border}`,
                borderRadius: '8px', color: C.hi, fontSize: '16px',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
