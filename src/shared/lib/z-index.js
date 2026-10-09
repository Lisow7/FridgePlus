// Sprint 5 PR S5.c — échelle z-index centralisée.
//
// Avant : 47 valeurs uniques de z-index disséminées dans tout le code
// (de 0 à 10100), avec collisions silencieuses, doublons (100/101/200/201),
// et ajouts au pifomètre quand une nouvelle modale devait passer au-dessus.
// Difficile de raisonner « qui est devant qui » sans grep.
//
// Après : une échelle ordonnée, nommée et commentée. Toute nouvelle
// surface UI choisit la constante qui correspond à sa catégorie, et la
// hiérarchie reste lisible d'un coup d'œil.
//
// Convention : les valeurs sont espacées (10, 50, 100, 200, 1000…) pour
// permettre des intermédiaires si un cas particulier surgit, sans avoir
// à renuméroter toute l'échelle.
//
// Stratégie de migration : cette PR crée le module et migre App.jsx (le
// hub des modales / toasts). Les autres composants migrent au fil des
// touches — pas de big-bang.

export const Z_INDEX = {
  // ─── Couches contenu ────────────────────────────────────────────
  // 0–9 : éléments dans le flux normal, layers internes (frigo, fond
  // décoratif, contenus statiques).
  BASE: 0,
  CONTENT_BACK: 1,
  CONTENT_FRONT: 10,

  // ─── UI inline (dropdowns, sticky bars) ─────────────────────────
  // 45–80 : éléments fixés au layout principal sans bloquer l'inter-
  // action avec le reste de la page. Drawers, sticky headers, dropdowns
  // de navigation.
  DRAWER_BACKDROP: 45,
  DRAWER: 46,
  DROPDOWN: 50,
  STICKY_HEADER: 60,
  STICKY_OVERLAY: 65,
  FOOTER: 70,

  // ─── Notifications / surfaces flottantes ────────────────────────
  // 100–200 : toasts, popovers, bannières non-modales. Au-dessus du
  // contenu sticky mais en-dessous des modales.
  TOAST: 100,
  TOAST_HIGH: 101,
  BANNER: 200,
  COOKIE_BANNER: 210,

  // ─── Modales et leurs surcouches ────────────────────────────────
  // 1000–1300 : modales (overlay full-screen) + popovers tactiles dans
  // les modales + modales au-dessus d'autres modales (ex : Upgrade au
  // top de Profile).
  MODAL_BACKDROP: 1000,
  MODAL: 1100,
  MODAL_POPOVER: 1200,
  TOP_MODAL: 1300,
  // Modale de confirmation (useConfirm()) — doit toujours passer au-dessus de
  // TOUTE modale existante, y compris celles qui l'ouvrent depuis leur propre
  // intérieur (ex. ShoppingListsModal, CommunityProfileModal).
  CONFIRM: 1400,

  // ─── Surcouches système (par-dessus TOUT) ───────────────────────
  // 9000+ : voice mini-panel (doit rester visible pendant la cuisine
  // même au-dessus d'une modale), debug, error boundary.
  VOICE_PANEL: 9000,
  DEV_OVERLAY: 9999,
  ERROR_OVERLAY: 10000,
}

// Helper pour produire un style inline `{ zIndex: Z.MODAL }`. Évite
// l'import nominatif partout : `style={zIndex(Z_INDEX.MODAL)}`.
// (Optionnel — la syntaxe `style={{ zIndex: Z_INDEX.MODAL }}` reste OK.)
export const zIndex = (value) => ({ zIndex: value })
