import { useRef, useState } from 'react'
import { useConsent } from '@shared/hooks/use-consent'
import { useBottomInsetPublisher } from '@shared/hooks/use-bottom-inset'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import { Z_INDEX } from '@shared/lib/z-index'
import { I18N } from '../i18n/consent-i18n'
import CookieModal from './cookie-modal'
import Button from '@shared/ui/button'

// Bandeau qui apparaît au premier accès tant que l'user n'a pas pris de
// décision sur les cookies/données. L'app reste utilisable en mode essentiels
// seuls par défaut.
//
// 🔴 « Non bloquant » était FAUX jusqu'au 2026-08-28 : cette phrase tenait pour
// le frigo desktop, pas pour le mobile. Le bandeau (`fixed`, 237-256 px de
// haut, z-index 9998 en dur) recouvrait le sélecteur de langue, la bascule de
// thème, les compartiments bas du frigo et le bouton « remonter en haut » des
// pages SEO — hit-test 5/5 en production. Depuis : il PUBLIE sa hauteur
// (`useBottomInsetPublisher`) et les surfaces du bas la réservent, et il est
// revenu sur l'échelle centralisée. ⛔ Ne jamais recoder son z-index en dur.
//
// CNIL (anti dark-pattern, enforcement actif — 331 mesures correctives 2024) :
// « Refuser tout » DOIT avoir le MÊME poids visuel que « Accepter tout » (même
// remplissage/couleur, pas un simple contour effacé). « Personnaliser » est la
// seule option visuellement moindre (chemin « plus d'options »).

// Le bandeau est TOUJOURS une bande pleine largeur posée juste au-dessus du pied
// de page. Ce seuil ne décide donc plus d'une forme, mais de deux choses :
//
//   1. la DISPOSITION — au-dessus, texte et commandes tiennent sur une ligne ;
//      en dessous, ils s'empilent, faute de largeur ;
//   2. la RÉSERVATION — la page d'accueil réserve la hauteur du bandeau en
//      dessous du seuil (c'est ce qui garde les bacs du bas cliquables sur
//      mobile) et ne la réserve PAS au-dessus : la scène frigo y est centrée
//      verticalement, donc réserver ferait SAUTER le frigo de ~80 px à
//      l'arrivée puis au départ du bandeau — vu par le mainteneur sur 2 556 px.
//      `app-shell` consomme la même constante.
//
// ⚠️ Cette constante s'est appelée `..._CORNER_MIN_WIDTH` jusqu'au 2026-09-12,
// du temps où le bandeau devenait une carte de coin de 380 px. Cette carte
// flottait dans le vide en bas à droite, sans rapport avec rien — signalée par
// le mainteneur. Le nom a suivi la réalité plutôt que l'inverse.
export const COOKIE_BANNER_LIGNE_MIN_WIDTH = 1600

export default function CookieBanner({ lang = 'fr', darkMode = false, onShowLegal }) {
  const t = I18N[lang] ?? I18N.fr
  const { hasDecided, accept, refuse } = useConsent()
  const [showCustom, setShowCustom] = useState(false)
  const bandeauRef = useRef(null)
  const surUneLigne = useWindowWidth() >= COOKIE_BANNER_LIGNE_MIN_WIDTH
  // Publie la hauteur réelle tant que le bandeau est là, libère dès qu'il part.
  // Appelé AVANT le retour anticipé : l'ordre des hooks doit rester stable.
  useBottomInsetPublisher(bandeauRef, !hasDecided)

  // Ne pas afficher si l'user a déjà décidé
  if (hasDecided) return null

  const bg = darkMode ? '#1A2F48' : '#FFFFFF'
  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'
  const muted = darkMode ? '#A0A8B8' : '#7A6A52'

  return (
    <>
      <div
        ref={bandeauRef}
        role="dialog"
        aria-label={t.bannerTitle}
        style={{
          // ── UNE BANDE, à toutes les largeurs ─────────────────────────────
          // Elle court d'un bord à l'autre et se cale juste AU-DESSUS du pied de
          // page (`--fp-footer-height`, publiée par le pied de page lui-même).
          //
          // 🔴 Ce n'est pas un choix esthétique. Jusqu'au 2026-09-12 le bandeau
          // flottait à `bottom: 16px`, donc PAR-DESSUS le pied de page : mesuré
          // à 1400 px, il recouvrait « Questions fréquentes », « Aide & Mentions
          // légales » et « Cookies » ; à 360 px il recouvrait en plus des bacs du
          // frigo. Personne ne l'avait vu parce que le cliquet du pied de page
          // donne le consentement, donc n'affiche jamais le bandeau. Posée
          // au-dessus du pied de page, la bande ne peut plus le recouvrir — la
          // géométrie le garantit, pas un z-index.
          position: 'fixed',
          left: 0, right: 0, bottom: 'var(--fp-footer-height, 0px)',
          maxWidth: 'none', margin: 0,
          borderRadius: 0, borderWidth: '1px 0 0 0',
          borderStyle: 'solid', borderColor: border,
          background: bg, color: fg,
          boxShadow: '0 -8px 28px rgba(0,0,0,0.18)',
          zIndex: Z_INDEX.COOKIE_BANNER,
          animation: 'consent-slide-up 0.3s ease-out',
          // Sur une ligne quand la largeur le permet, empilé sinon.
          ...(surUneLigne
            ? { padding: '13px clamp(16px, 4vw, 48px)', display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }
            : { padding: '14px 16px' }),
        }}
      >
        <style>{`@keyframes consent-slide-up { from { transform: translateY(30px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>

        <div style={surUneLigne
          ? { display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 420px', minWidth: 0 }
          : { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.bannerTitle}</div>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: muted, margin: 0 }}>
              {t.bannerIntro}
            </p>
            {onShowLegal && (
              <Button
                variant="ghost"
                onClick={onShowLegal}
                className="mt-1.5 h-auto rounded-none bg-transparent p-0 text-xs font-semibold underline hover:bg-transparent"
                style={{ color: darkMode ? 'var(--color-brand-400)' : '#C05A10' }}
              >
                {t.bannerSeeMore} →
              </Button>
            )}
          </div>
        </div>

        <div style={surUneLigne
          ? { display: 'flex', gap: 8, flexWrap: 'wrap', flex: '0 0 auto', marginLeft: 'auto' }
          : { display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* La couleur du TEXTE suit le thème, parce que le fond, lui, le suit
              déjà : `--color-warm-600` vaut `#B85000` en clair et `#D8901E` en
              sombre. Un texte blanc écrit en dur convenait au premier et pas au
              second — il y tombait à 2,64:1, pour un seuil WCAG AA de 4,5.

              🔴 Personne ne pouvait le voir : la correction de contraste du
              2026-07-11 n'avait porté que sur le thème clair, et tous les
              garde-fous a11y du dépôt lisaient le source sans jamais rendre la
              page. Mesuré le 2026-08-22 par `e2e/a11y.spec.js`, sur les 6 pages
              publiques et dans les deux thèmes.

              Les quatre mesures, prises au navigateur :

                            texte/bouton   bouton/fond de bannière
                clair          5,02:1              5,02:1
                sombre         6,25:1              5,13:1
                seuil          4,5 (1.4.3)         3,0 (1.4.11)

              ⚠️ La seconde colonne est ce qui a écarté la solution évidente —
              reprendre le `#B85000` du variant `primary`, cohérent avec tous
              les autres boutons de l'app. Le texte y passait bien à 5,02:1,
              mais le bouton tombait alors à 2,71:1 contre le fond de la
              bannière, sous le seuil des composants d'interface. Sur ce fond,
              AUCUNE couleur unie ne satisfait les deux avec du texte blanc : il
              faudrait une luminance à la fois inférieure à 0,175 et supérieure
              à 0,189. D'où le texte sombre — le patron « on-primary » : quand
              la couleur d'accent s'éclaircit, ce qui s'écrit dessus s'assombrit.

              Les deux boutons restent strictement identiques entre eux :
              l'exigence CNIL rappelée juste en dessous ne bouge pas. */}
          {/* Refuser = même poids visuel qu'Accepter (rempli, même couleur) → CNIL */}
          <Button
            onClick={refuse}
            className={`h-auto rounded-lg bg-[var(--color-warm-600)] px-4 py-2.5 text-[13px] font-bold ${surUneLigne ? '' : 'flex-1'}`}
            style={{ minWidth: 110, whiteSpace: 'nowrap', color: darkMode ? '#2D1B00' : '#FFFFFF' }}
          >
            {t.btnRefuseAll}
          </Button>
          <Button
            onClick={accept}
            className={`h-auto rounded-lg bg-[var(--color-warm-600)] px-4 py-2.5 text-[13px] font-bold ${surUneLigne ? '' : 'flex-1'}`}
            style={{ minWidth: 110, whiteSpace: 'nowrap', color: darkMode ? '#2D1B00' : '#FFFFFF' }}
          >
            {t.btnAcceptAll}
          </Button>
          {/* Personnaliser = seule option visuellement moindre (chemin « plus d'options ») */}
          <Button
            variant="secondary"
            onClick={() => setShowCustom(true)}
            // En BANDE, les trois commandes tiennent sur une seule ligne — sinon
            // « Personnaliser » passe dessous et la bande gonfle a 111 px, ce qui
            // n'est plus une ligne mais une carte couchee. En carte (petit ecran),
            // elle reste pleine largeur sous les deux autres.
            className={`h-auto rounded-lg border bg-transparent px-4 py-2 text-[12.5px] font-semibold ${surUneLigne ? 'w-auto' : 'w-full'}`}
            style={{
              borderColor: darkMode ? 'var(--color-dark-border)' : '#D4C8B5',
              color: darkMode ? 'var(--color-bg-warm)' : '#2C1A0E',
            }}
          >
            {t.btnCustomize}
          </Button>
        </div>
      </div>

      {showCustom && (
        <CookieModal
          lang={lang}
          darkMode={darkMode}
          onClose={() => setShowCustom(false)}
          onShowLegal={onShowLegal}
        />
      )}
    </>
  )
}
