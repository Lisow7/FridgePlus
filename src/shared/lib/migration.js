import { supabase } from '@shared/lib/supabase/client'
import { migrationUpsertCommunityRecipes } from '@shared/lib/recipes/recipes-repository'

// ⛔ PLUS AUCUN DRAPEAU DE MIGRATION (retirés le 2026-08-28, audit).
//
// Il y en avait trois, dans localStorage — donc à portée NAVIGATEUR — et ils
// n'étaient purgés nulle part. Conséquence sur un poste partagé ou un simple
// re-test : A se connecte (drapeau posé) → se déconnecte → un invité remplit
// le frigo → quelqu'un se reconnecte → le frigo de l'invité est IGNORÉ, puis
// détruit au removeItem de la déconnexion suivante. Même résultat que
// l'incident du 21 août, par un autre chemin.
//
// 🥇 Ils étaient devenus REDONDANTS : depuis le correctif d'août, les clés de
// données ne sont effacées qu'APRÈS confirmation de l'écriture. Leur présence
// EST le signal « pas encore migré ». Deux signaux pour une même vérité ne
// pouvaient que diverger.
//
// ⚠️ Ne pas « corriger » en posant une clé par utilisateur : ça ne couvre pas
// le cas A → invité → A, qui est justement celui du re-test.
//
// Historique conservé pour mémoire :
//
// Pourquoi 2 flags ? Avant v3.20.6 la migration ne couvrait que stock + favs.
// Les users qui s'étaient connectés à cette époque ont posé le flag legacy à
// '1', mais leurs recettes custom étaient restées en localStorage (perte
// silencieuse). Avec un seul flag, la migration custom ajoutée en v3.20.6 ne
// se déclencherait jamais pour ces users → recettes inaccessibles dans leur
// compte.
//
// Un drapeau dédié avait alors été ajouté pour rattraper ces comptes. Le
// retrait complet des drapeaux règle le même cas, en mieux : la présence des
// clés de données fait foi, et elle est vraie pour tout le monde.
const STOCK_KEY             = 'fridge-stock'
const FAVORITES_KEY         = 'fridge-favorites'
const CUSTOM_RECIPES_KEY    = 'fridge-custom-recipes'
const ALLERGENS_KEY         = 'fridge-allergen-prefs'

export async function migrateLocalStorageToDB(userId) {
  try {
    // ── Stock + favoris : rejoué à chaque connexion, no-op sans données ──
    {
      const rawStock = JSON.parse(localStorage.getItem(STOCK_KEY) ?? '[]')
      const favIds   = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]')

      // Anti-gaspi 1A : conserver la fraîcheur (added_at/expires_at) en migrant
      // invité → auth. Gère le nouveau format objet ET l'ancien (strings).
      const stockRows = rawStock.map(e => typeof e === 'string'
        ? { user_id: userId, ingredient_id: e, added_at: new Date().toISOString(), expires_at: null }
        : { user_id: userId, ingredient_id: e.id, added_at: e.addedAt ?? new Date().toISOString(), expires_at: e.expiresAt ?? null })

      // 🔴 `ignoreDuplicates: true` — indispensable, et pas un détail de style.
      // Sans lui, PostgREST traduit l'upsert en `ON CONFLICT DO UPDATE`, ce qui
      // exige une policy UPDATE. Or `user_stock` et `user_favorites` n'en ont
      // AUCUNE (SELECT, INSERT, DELETE seulement) : une seule ligne déjà
      // présente suffisait à faire échouer TOUT le lot en 403.
      //
      // La sémantique est aussi la bonne : si l'ingrédient est déjà dans le
      // compte, la ligne du compte gagne — on ne réécrit pas sa fraîcheur avec
      // celle de l'invité. C'est déjà ce que font `addToStock` et le panier.
      if (stockRows.length > 0) {
        const { error } = await supabase.from('user_stock').upsert(
          stockRows,
          { onConflict: 'user_id,ingredient_id', ignoreDuplicates: true }
        )
        if (error) throw error
      }

      if (favIds.length > 0) {
        const { error } = await supabase.from('user_favorites').upsert(
          favIds.map(id => ({ user_id: userId, recipe_id: id })),
          { onConflict: 'user_id,recipe_id', ignoreDuplicates: true }
        )
        if (error) throw error
      }

      // 🔴 On n'efface la SOURCE qu'une fois la destination confirmée.
      // Avant le 2026-08-21, ces trois lignes s'exécutaient quoi qu'il arrive :
      // l'écriture échouait en 403, le localStorage était vidé et le flag posé
      // — donc plus jamais retenté. Le frigo et les favoris de l'invité étaient
      // perdus, sans un mot. Prouvé de bout en bout : 5 ingrédients sur 6
      // disparus, à cause d'un seul doublon.
      //
      // 🥇 Un `await` dont on ne lit pas le résultat est un échec silencieux
      // organisé — ici il armait la destruction de la seule copie des données.
      localStorage.removeItem(STOCK_KEY)
      localStorage.removeItem(FAVORITES_KEY)
    }

    // ── Recettes créées par l'utilisateur : même règle, rejouable ──
    {
      const customRecipes = JSON.parse(localStorage.getItem(CUSTOM_RECIPES_KEY) ?? '[]')

      if (customRecipes.length > 0) {
        const rows = customRecipes.map(recipe => {
          const { id, ...data } = recipe
          return {
            id,
            user_id: userId,
            title: recipe.name ?? recipe.title ?? '',
            data,
            moderation_status: 'private',
            is_public: false,
            consent_to_promote: false,
          }
        })
        // Sprint 5f : délégué au repository (idempotent via INSTEAD OF trigger).
        const { error } = await migrationUpsertCommunityRecipes(rows)
        // Ce sont les recettes ÉCRITES par l'utilisateur : les effacer sur un
        // échec d'écriture serait la perte la plus coûteuse des trois.
        if (error) throw error
      }

      localStorage.removeItem(CUSTOM_RECIPES_KEY)
    }

    // ── Allergènes déclarés en invité (audit 2026-10-02) ──
    // Un invité peut les régler depuis le tiroir des filtres ; les perdre en
    // créant son compte serait l'oubli le plus grave des cinq blocs (sécurité).
    // UNION avec le profil : en ajouter n'est jamais risqué, en retirer l'est.
    // Même règle que plus haut : la copie locale ne part qu'après l'écriture.
    {
      const local = JSON.parse(localStorage.getItem(ALLERGENS_KEY) ?? '[]')
      if (Array.isArray(local) && local.length > 0) {
        const { data, error: readError } = await supabase
          .from('profiles').select('allergen_prefs').eq('id', userId).single()
        if (readError) throw readError
        const current = data?.allergen_prefs ?? []
        const merged = [...new Set([...current, ...local])]
        if (merged.length > current.length) {
          const { error } = await supabase.from('profiles').update({ allergen_prefs: merged }).eq('id', userId)
          if (error) throw error
        }
        localStorage.removeItem(ALLERGENS_KEY)
      }
    }

    // ⛔ Le bloc « événements anti-gaspi » a été retiré le 2026-08-28 :
    // plus aucun code n'écrit la clé `fridge-anti-gaspi-events` depuis le
    // retrait de l'anti-gaspi/DLC. Il ne faisait rien, et il était le SEUL
    // bloc non idempotent du fichier (insert sans onConflict) — donc un
    // générateur de doublons le jour où il aurait redémarré.

    // ── Report de la progression d'onboarding invité → compte (localStorage) ──
    // Données device-local : on déplace la clé 'guest' vers l'uid (merge OR-wins
    // sur les flags booléens) puis on SUPPRIME la clé invité (propriété de
    // confidentialité + évite le résidu pour le prochain visiteur d'un navigateur
    // partagé). Idempotent (sans clé guest = no-op).
    const GUEST_ONBOARD_KEY = 'fridge-getting-started-v1:guest'
    const guestRaw = localStorage.getItem(GUEST_ONBOARD_KEY)
    if (guestRaw) {
      const guest = JSON.parse(guestRaw)
      const userKey = `fridge-getting-started-v1:${userId}`
      const cur = JSON.parse(localStorage.getItem(userKey) || '{}')
      localStorage.setItem(userKey, JSON.stringify({
        ...cur,
        step2_opened: !!(cur.step2_opened || guest.step2_opened),
        dismissed: !!(cur.dismissed || guest.dismissed),
      }))
      localStorage.removeItem(GUEST_ONBOARD_KEY)
    }
  } catch (err) {
    // On sort SANS avoir effacé quoi que ce soit ni posé de flag : la migration
    // sera retentée à la prochaine connexion. Les écritures ci-dessus sont
    // idempotentes (`ignoreDuplicates`, trigger `INSTEAD OF`), donc rejouables
    // sans doublon — c'est ce qui rend cette sortie sûre.
    if (import.meta.env.DEV) console.error('Migration localStorage → Supabase échouée :', err)
  }
}
