import { useReducer, useCallback, useMemo } from 'react'

// Hook centralisé pour toutes les modales/panels top-level de l'app.
// Sprint 10 S10.a.1 — extrait depuis App.jsx pour alléger le composant
// racine vers <100 lignes.
//
// API :
//   const modals = useAppModals()
//   modals.community.isOpen / modals.community.open(recipeId) / ...
//   modals.cart.isOpen / modals.cart.open({ openLists: true }) / ...
//
// Modales gérées : admin, support, cart (+ openListsOnCart),
// addToFridge, voiceConfirm, voiceModal, welcome, receiptReview.
//
// Sprint 11 S11.a.6 — `profile` retiré : remplacé par la route /profile
// (cf. routes-config.js + ProfilePage). Le Header navigate('/profile').
// Sprint 11 S11.b.5 — `auth` retiré : remplacé par les routes /login,
// /signup, /auth/recovery. Le Header navigate('/login'|'/signup').
// Sprint 11 S11.c.5 — `communityRecipeId` retiré : Communauté utilise
// navigate('/recipe/:id') (page pleine RecipePage).
// Sprint 11 S11.d — `community` retiré : la Communauté est désormais
// une route /community (cf. routes-config.js + CommunityPageRoute).

const INITIAL = {
  admin:             false,
  support:           false,
  cart:              false,
  openListsOnCart:   false,    // one-shot : ouvrir « Mes listes » à l'open
  addToFridge:       false,
  voiceConfirm:      false,
  voiceModal:        false,
  welcome:           false,
  receiptReview:     false,
}

function reducer(state, action) {
  switch (action.type) {
    case 'OPEN':  return { ...state, [action.key]: true,  ...(action.extra || {}) }
    case 'CLOSE': return { ...state, [action.key]: false, ...(action.extra || {}) }
    case 'SET':   return { ...state, [action.key]: action.value }
    default:      return state
  }
}

export function useAppModals(initialOverrides = {}) {
  const [state, dispatch] = useReducer(reducer, { ...INITIAL, ...initialOverrides })

  const make = useCallback((key) => ({
    isOpen: state[key],
    open:   () => dispatch({ type: 'OPEN',  key }),
    close:  () => dispatch({ type: 'CLOSE', key }),
  }), [state])


  const api = useMemo(() => ({
    admin:           make('admin'),
    support:         make('support'),
    cart: {
      isOpen:        state.cart,
      openListsOnOpen: state.openListsOnCart,
      open:  ({ openLists = false } = {}) => dispatch({ type: 'OPEN',  key: 'cart', extra: { openListsOnCart: openLists } }),
      close: ()                           => dispatch({ type: 'CLOSE', key: 'cart' }),
      consumeOpenLists: ()                => dispatch({ type: 'SET',   key: 'openListsOnCart', value: false }),
    },
    addToFridge:     make('addToFridge'),
    voiceConfirm:    make('voiceConfirm'),
    voiceModal:      make('voiceModal'),
    receiptReview:   make('receiptReview'),
    welcome: {
      isOpen: state.welcome,
      open:   () => dispatch({ type: 'OPEN',  key: 'welcome' }),
      close:  () => dispatch({ type: 'CLOSE', key: 'welcome' }),
      set:    (v) => dispatch({ type: 'SET',  key: 'welcome', value: v }),
    },
  }), [state, make])

  return api
}
