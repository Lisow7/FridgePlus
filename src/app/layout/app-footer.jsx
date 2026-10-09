import Footer from '@app/layout/footer'

// Footer de l'app — rendu en FLUX NORMAL sur toutes les tailles.
//
// Historique : sur mobile (< 640px), le footer était un bottom-sheet caché
// (peek 36px, tap pour déployer) afin de dégager le contenu. Retiré (2026-07)
// à la demande produit : le footer redevient un vrai footer visible, adapté
// mobile via sa propre mise en page responsive (`lg:hidden` = 2 lignes
// centrées). Le composant `Footer` gère déjà mobile/tablette/desktop.
//
// Le wrapper `<div ref={footerRef}>` réserve la hauteur pour useResponsiveLayout
// (calcul du scale du frigo). Les props `windowWidth/footerExpanded/
// setFooterExpanded` sont conservées dans la signature pour ne pas casser le
// call-site, mais ne pilotent plus d'affichage. `isHome` en revanche est
// transmis à `Footer` : la fusée « Bien démarrer » ne doit s'afficher QUE sur
// l'accueil, comme `FridgeFAB` (chantier D/H, 2026-07-09 — sinon elle flotte
// sur /legal, /community, /profile... alors que le guide qu'elle rouvre ne
// vit que sur le frigo).
// ⚠️ `isHome` vaut ici « accueil affiché SANS panneau par-dessus » : App.jsx le
// passe faux dès qu'un panneau recouvre l'accueil, sinon la fusée restait posée
// sur le panneau admin ou la liste d'un bac (audit 2026-10-04, P-07).
export default function AppFooter({
  isHome,
  // eslint-disable-next-line no-unused-vars
  windowWidth,
  // eslint-disable-next-line no-unused-vars
  footerExpanded,
  // eslint-disable-next-line no-unused-vars
  setFooterExpanded,
  footerRef,
  lang,
  darkMode,
}) {
  return (
    <div ref={footerRef}>
      <Footer darkMode={darkMode} lang={lang} isHome={isHome} />
    </div>
  )
}
