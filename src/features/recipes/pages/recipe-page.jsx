import { useParams, Link } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { LuArrowLeft, LuSearchX } from 'react-icons/lu'
import { useRecipeById } from '@features/recipes/hooks/use-recipe-by-id'
import { useSmartBack } from '@shared/hooks/use-smart-back'
import { useDocumentTitle } from '@shared/hooks/use-document-title'
import { useStockSession, useFavoritesSession, useCartSession } from '@shared/contexts/session-state-context'
import { useRecipeForm } from '@shared/contexts/recipe-form-context'
import { useDeletingRecipe } from '@shared/contexts/deleting-recipe-context'
import { useAuth } from '@shared/contexts/auth-provider'
import { useSubscription } from '@shared/hooks/use-subscription'
import { useIngredientsById, useBaseRecipes } from '@shared/contexts/data-provider'
// eslint-disable-next-line import/no-restricted-paths -- couche page (composition) : réutilise l'action panier testée (DRY) plutôt que de la dupliquer.
import { useCartActions } from '@features/cart/hooks/use-cart-actions'
import PageSkeleton from '@routes/page-skeleton'

// RecipeModal volontairement lazy pour ne pas tirer 1705 L (modale +
// ses dépendances) dans le chunk init de RecipePage. Les call-sites
// SPA continuent à lazy-loader la même modale via leur propre flow,
// donc pas de double chunk.
const RecipeModal = lazy(() => import('@features/recipes/components/recipe-modal'))

// RecipePage — Sprint 11 S11.c.1 + S11.c.2.
//
// Page routée `/recipe/:id`, toujours rendue en page pleine
// (variant='page'). Atteinte par deep-link (lien partagé, refresh,
// nouvel onglet) comme par navigation interne depuis le panneau de
// recettes, la Communauté ou le Journal (clic recette = changement de
// page). Le browsing se fait dans le panneau in-app (overlay ?recettes=1).
//
// Sprint 11 S11.c.2 — branchement complet stock/favorites/handlers via
// SessionStateProvider context. La page cold-load a désormais la même
// interactivité que la modale SPA : % match stock affiché correctement,
// cœur favori cliquable et persisté, toggle ingrédient stock fonctionnel.
//
// Parité complète avec la modale SPA : panier (via CartSession lifté en
// context + useCartActions), édition/suppression recettes custom (form +
// delete contexts). Boutons cachés tant que les conditions ne sont pas
// remplies (premium pour le panier, ownership pour edit/delete).
//
// Pourquoi pas d'AuthGuard sur cette route :
//   - Les recettes publiques doivent fonctionner pour les invités —
//     c'est tout l'intérêt d'avoir des URLs partageables.
//   - L'auth (lecture d'une recette privée non publiée) est enforcée
//     au niveau data, pas au niveau route : RLS Supabase + le hook
//     `useRecipeById` retournent `status='not-found'` si l'user n'a pas
//     accès. On ne distingue pas « inexistante » de « privée pas à toi »
//     → évite le leak RGPD d'existence d'une recette privée.
//
// onClose smart-back via `useSmartBack` :
//   - Si l'user a une history (navigation interne SPA) → `navigate(-1)`,
//     revient à la page précédente (communauté, recettes, journal…).
//   - Si l'user a atterri directement (history vide) → `navigate('/')`,
//     ramène à l'accueil de l'app au lieu de sortir vers le site
//     précédent du navigateur.

const I18N = {
  fr: {
    notFoundTitle: 'Recette introuvable',
    notFoundSubtitle: 'Cette recette n\'existe pas, a été supprimée, ou n\'est pas accessible publiquement.',
    errorTitle: 'Recette momentanément indisponible',
    errorSubtitle: 'Nous n\'avons pas réussi à charger cette recette. Vérifie ta connexion et réessaie — le lien, lui, est toujours valable.',
    backHome: 'Retour à l\'accueil',
  },
  en: {
    notFoundTitle: 'Recipe not found',
    notFoundSubtitle: 'This recipe doesn\'t exist, was removed, or isn\'t publicly accessible.',
    errorTitle: 'Recipe temporarily unavailable',
    errorSubtitle: 'We couldn\'t load this recipe. Check your connection and try again — the link itself is still valid.',
    backHome: 'Back to home',
  },
}

export default function RecipePage({ lang = 'fr', darkMode = false }) {
  const { id } = useParams()
  const { recipe, status } = useRecipeById(id)
  const onClose = useSmartBack('/')

  // ── Le titre de l'onglet, et pourquoi il ne suffit PAS de le pré-rendre ───
  // Le HTML servi porte bien « <nom> — Fridge+ » (cf. scripts/prerender.mjs).
  // Mais pour un visiteur qui a déjà ouvert le site, c'est le SERVICE WORKER
  // qui répond : son `navigateFallback` sert `index.html` depuis le cache, et
  // cette coquille porte le titre générique. Constaté en production le
  // 2026-08-21 — `curl` voyait « Salade César — Fridge+ », le navigateur
  // « Fridge+ — Gérez votre frigo… ».
  //
  // ⚠️ Aucune conséquence SEO : les robots n'installent pas de service worker,
  // ils reçoivent le fichier pré-rendu. C'est l'utilisateur qui y perdait —
  // plusieurs onglets de recettes portaient tous le même nom.
  //
  // Ce hook pose le MÊME titre que le pré-rendu, il ne le contredit jamais : il
  // le réaffirme quand le service worker l'a effacé. Il ne touche ni au
  // canonical ni aux `og:*`, qui appartiennent au HTML servi.
  // Le nom des recettes de base vit dans une MAP SÉPARÉE, pas dans l'objet
  // recette : `RECIPES` (static) ne porte ni `name` ni `title`. Utiliser
  // `recipe.name` y retombe sur l'identifiant — l onglet affichait
  // « carbonara » au lieu de « Pasta Carbonara ». Même motif que
  // `recipe-card.jsx`, qui résout ce nom depuis toujours.
  const { recipeNames: RECIPE_NAMES } = useBaseRecipes()
  const nomRecette = !recipe
    ? ''
    : (recipe.isCustom ? (recipe.name ?? '') : (RECIPE_NAMES?.[recipe.id]?.[lang] ?? ''))
  useDocumentTitle(nomRecette ? `${nomRecette} — Fridge+` : '')
  // « Toutes les recettes » : si on vient d'une navigation interne (panneau,
  // communauté, journal), navigate(-1) restaure l'URL précédente — donc les
  // filtres (URL-synced) ET le scroll (sessionStorage) du panneau. En
  // deep-link direct (pas d'historique interne), on ouvre le panneau via
  // /?recettes=1 (fallback). useSmartBack encapsule ce choix.
  const onAllRecipes = useSmartBack('/?recettes=1')
  const t = I18N[lang] ?? I18N.fr

  // Sprint 11 S11.c.2 — session state via context (single source of
  // truth partagée avec App.jsx). Permet à la page cold-load d'avoir
  // les vraies interactions, pas des EMPTY_SET stub.
  const { stock, toggleIngredient } = useStockSession()
  const { favorites, toggleFavorite } = useFavoritesSession()
  const { user, allergenPrefs } = useAuth()
  // Parité avec la modale SPA : ajout au panier dans le détail recette.
  // Le panier est lifté en context (CartSession) ; l'action est composée ici.
  const { basket, basketRecipeIds, refresh: refreshBasket } = useCartSession()
  const { hasPremiumAccess } = useSubscription()
  const ingredientsById = useIngredientsById()
  const { handleAddToCart } = useCartActions({ user, basket, stock, lang, ingredientsById, refreshBasket })
  // Sécurité / modèle 3 tiers : action passée UNIQUEMENT au premium ;
  // gratuit/anonyme → undefined → bouton masqué par RecipeModal
  // (`onAddToCart && hasPremiumAccess`). `addBasketItems` reste RLS user-only.
  const onAddToCart = hasPremiumAccess ? handleAddToCart : undefined
  // Sprint 11 S11.e.2 — edit/delete via contexts globaux (form + delete).
  // Affichage des boutons UNIQUEMENT si recipe.isCustom && recipe est
  // possédée par l'user courant. RLS Supabase enforce côté serveur.
  const { openEdit: openEditForm } = useRecipeForm()
  const { requestDelete } = useDeletingRecipe()
  const isOwnedCustom = !!(recipe?.isCustom && user?.id && recipe?.user_id === user.id)
  const onEditRecipe = isOwnedCustom
    ? (r) => { openEditForm(r); onClose() }
    : undefined
  const onDeleteRecipe = isOwnedCustom
    ? () => { requestDelete(recipe); onClose() }
    : undefined

  if (status === 'loading') {
    return <PageSkeleton lang={lang} darkMode={darkMode} />
  }

  // Panne technique : on ne dit PAS « recette introuvable », ce qui ferait
  // croire que le lien est mort et dissuaderait de réessayer.
  if (status === 'error') {
    return <RecipeUnavailable t={t} darkMode={darkMode} title={t.errorTitle} subtitle={t.errorSubtitle} />
  }

  if (status === 'not-found' || !recipe) {
    return <RecipeUnavailable t={t} darkMode={darkMode} title={t.notFoundTitle} subtitle={t.notFoundSubtitle} />
  }

  return (
    <Suspense fallback={<PageSkeleton lang={lang} darkMode={darkMode} />}>
      <RecipeModal
        recipe={recipe}
        lang={lang}
        darkMode={darkMode}
        onClose={onClose}
        onAllRecipes={onAllRecipes}
        variant="page"
        // Sprint 11 S11.c.2 — vraies données depuis SessionStateProvider.
        stock={stock}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onToggleIngredient={toggleIngredient}
        allergenPrefs={allergenPrefs ?? []}
        // Sprint 11 S11.e.2 — edit/delete via contexts (form + delete)
        // affichés seulement si user owns la recette. RLS Supabase
        // enforce côté serveur (defense in depth).
        onEditRecipe={onEditRecipe}
        onDeleteRecipe={onDeleteRecipe}
        onAddToCart={onAddToCart}
        basketRecipeIds={basketRecipeIds}
      />
    </Suspense>
  )
}

// Écran « la recette ne s'affiche pas », avec son motif en props : la page
// distingue une recette inaccessible (`not-found`) d'une panne technique
// (`error`) — même mise en page, message différent.
function RecipeUnavailable({ t, darkMode, title, subtitle }) {
  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted = darkMode ? 'rgba(240,232,220,0.7)' : 'rgba(44,26,14,0.65)'

  return (
    <div style={{
      maxWidth: '520px', margin: '0 auto',
      padding: '64px 24px',
      color: fg,
      textAlign: 'center',
    }}>
      <div style={{
        display: 'inline-flex',
        padding: '24px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(247,168,94,0.18) 0%, rgba(212,106,16,0.10) 100%)',
        marginBottom: '24px',
      }}>
        <LuSearchX size={48} style={{ color: '#D46A10' }} />
      </div>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '12px' }}>
        {title}
      </h1>
      <p style={{ fontSize: '16px', color: muted, marginBottom: '32px', lineHeight: 1.5 }}>
        {subtitle}
      </p>
      <Link
        to="/"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '12px 24px',
          borderRadius: '10px',
          background: 'var(--gradient-warm)',
          color: '#FFFFFF',
          fontWeight: 600,
          textDecoration: 'none',
          boxShadow: '0 2px 10px rgba(212,106,16,0.25)',
        }}
      >
        <LuArrowLeft size={18} />
        {t.backHome}
      </Link>
    </div>
  )
}
