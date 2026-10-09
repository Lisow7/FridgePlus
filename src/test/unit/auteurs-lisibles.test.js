import { describe, it, expect, vi, beforeEach } from 'vitest'

// La « base » : chaque table rend la ligne qu'on lui donne, et la fonction
// `get_public_profiles` rend les profils publics demandés. On garde les
// sélections demandées (pour vérifier qu'aucune ne joint plus `profiles`) et
// les appels de fonction.
const etat = vi.hoisted(() => ({ tables: {}, rpc: {}, selections: [], appels: [] }))

vi.mock('@shared/lib/supabase/client', () => {
  const requete = (table) => {
    const resultat = () => etat.tables[table] ?? { data: [], error: null }
    const q = {}
    for (const m of ['eq', 'is', 'in', 'neq', 'ilike', 'order', 'range', 'limit', 'insert', 'update', 'upsert']) q[m] = () => q
    q.select = (cols) => { etat.selections.push(`${table}: ${cols}`); return q }
    q.single = () => Promise.resolve(resultat())
    q.maybeSingle = () => Promise.resolve(resultat())
    q.then = (ok, ko) => Promise.resolve(resultat()).then(ok, ko)
    return q
  }
  return {
    supabase: {
      from: (table) => requete(table),
      rpc: (nom, args) => {
        etat.appels.push([nom, args])
        const r = etat.rpc[nom]
        if (r instanceof Error) return Promise.reject(r)
        if (typeof r === 'function') return Promise.resolve(r(args))
        return Promise.resolve(r ?? { data: [], error: null })
      },
    },
  }
})
vi.mock('@shared/lib/recipes/recipes-repository', () => ({
  findCommunityRecipesForResolution: vi.fn(), findCommunityRecipeNamesByIds: vi.fn(),
  findPublicCommunityRecipesAttachable: vi.fn(), findPublicCommunityRecipesByUser: vi.fn(),
  findCommunityRecipeTitlesByIds: vi.fn(), findOfficialRecipeNamesByIds: vi.fn(),
}))

import { loadPublicProfiles, withAuthorProfiles } from '@shared/api/public-profiles'
import { listPosts, getPost, createPost, updatePost, listReplies, createReply, getCommunityProfile } from '@shared/api/community'
import { loadReviews, getMyReview, upsertReview } from '@features/recipes/api/recipe-reviews'
import { searchUsersForReport } from '@features/support/api/support'
import { authorName } from '@shared/lib/author-name'

// Audit du 2026-10-04, BDD-13 : la table `profiles` ne se lit que pour SA
// ligne (ou en admin). Les posts, les réponses et les avis joignaient le
// profil de l'auteur : pour tout lecteur non admin, l'auteur revenait vide →
// « Utilisateur supprimé », « Anonyme », « Profil introuvable ». Les auteurs
// sont désormais lus par la fonction `get_public_profiles` de la base (pseudo,
// avatar, bannière, bio, date d'inscription — rien d'autre).
const ALICE = { id: 'u-alice', username: 'Alice', avatar_id: 'av-3', banner_id: 'bn-1', community_bio: 'Cuisine du marché', created_at: '2026-05-01T10:00:00Z' }
const profilsRendus = (ids) => ({ data: [ALICE].filter((p) => ids.p_ids.includes(p.id)), error: null })

beforeEach(() => {
  etat.tables = {}
  etat.rpc = { get_public_profiles: profilsRendus }
  etat.selections = []
  etat.appels = []
})

const appelsProfils = () => etat.appels.filter(([nom]) => nom === 'get_public_profiles')

describe('withAuthorProfiles — le nom de chaque auteur, par la fonction publique', () => {
  it('chaque ligne reçoit le pseudo et l’avatar de son auteur, et rien d’autre', async () => {
    const lignes = await withAuthorProfiles([{ id: 'p-1', user_id: 'u-alice' }])
    expect(lignes).toEqual([{ id: 'p-1', user_id: 'u-alice', profile: { username: 'Alice', avatar_id: 'av-3' } }])
  })

  it('un auteur que la base ne rend pas (compte supprimé) : pas de profil, et ce n’est PAS une panne', async () => {
    const [ligne] = await withAuthorProfiles([{ id: 'p-1', user_id: 'u-parti' }])
    expect(ligne.profile).toBeNull()
    expect(ligne.profileUnavailable).toBeUndefined()
  })

  it('un seul appel, un identifiant par auteur, sans les vides', async () => {
    await withAuthorProfiles([{ user_id: 'u-alice' }, { user_id: 'u-bob' }, { user_id: 'u-alice' }, { user_id: null }])
    expect(appelsProfils()).toEqual([['get_public_profiles', { p_ids: ['u-alice', 'u-bob'] }]])
  })

  it('aucun auteur connu : aucun appel', async () => {
    const lignes = await withAuthorProfiles([{ id: 'p-1', user_id: null }])
    expect(appelsProfils()).toHaveLength(0)
    expect(lignes[0].profile).toBeNull()
  })

  it('au-delà de 200 auteurs, plusieurs appels de 200 au plus (la base ignore le reste)', async () => {
    const lignes = Array.from({ length: 450 }, (_, i) => ({ user_id: `u-${i}` }))
    await withAuthorProfiles(lignes)
    expect(appelsProfils().map(([, args]) => args.p_ids.length)).toEqual([200, 200, 50])
  })

  it('la lecture des profils échoue : les lignes le disent, au lieu de passer pour des comptes supprimés', async () => {
    etat.rpc.get_public_profiles = { data: null, error: { message: 'boom' } }
    const [ligne] = await withAuthorProfiles([{ id: 'p-1', user_id: 'u-alice' }])
    expect(ligne.profile).toBeNull()
    expect(ligne.profileUnavailable).toBe(true)
  })

  it('… même quand l’appel lève au lieu de rendre une erreur', async () => {
    etat.rpc.get_public_profiles = new Error('réseau')
    const [ligne] = await withAuthorProfiles([{ id: 'p-1', user_id: 'u-alice' }])
    expect(ligne.profileUnavailable).toBe(true)
  })

  it('loadPublicProfiles rend les profils complets, rangés par identifiant', async () => {
    const { profiles, error } = await loadPublicProfiles(['u-alice'])
    expect(error).toBeNull()
    expect(profiles.get('u-alice')).toEqual(ALICE)
  })
})

describe('la communauté lit ses auteurs par la fonction publique, plus par une jointure', () => {
  const POST = { id: 'p-1', user_id: 'u-alice', title: 'Astuce', body: 'Congeler le pain.', likes_count: 0, replies_count: 0 }
  const REPONSE = { id: 'r-1', post_id: 'p-1', user_id: 'u-alice', body: 'Merci !', likes_count: 0 }

  it.each([
    ['listPosts', () => listPosts(), 'community_posts', [POST]],
    ['getPost', () => getPost('p-1'), 'community_posts', POST],
    ['listReplies', () => listReplies('p-1'), 'community_replies', [REPONSE]],
  ])('%s : l’auteur a un nom', async (_, appel, table, rendu) => {
    etat.tables[table] = { data: rendu, error: null }
    const resultat = await appel()
    const ligne = Array.isArray(resultat) ? resultat[0] : resultat
    expect(ligne.profile).toEqual({ username: 'Alice', avatar_id: 'av-3' })
    expect(etat.selections.join(' | ')).not.toMatch(/profiles/)
  })

  it.each([
    ['createPost', () => createPost('u-alice', { category: 'tips', title: 'Astuce', body: 'Congeler le pain.' }), 'community_posts', POST],
    ['updatePost', () => updatePost('p-1', { title: 'Astuce' }), 'community_posts', POST],
    ['createReply', () => createReply('u-alice', 'p-1', 'Merci !'), 'community_replies', REPONSE],
  ])('%s : ce qui vient d’être écrit revient avec le nom de son auteur', async (_, appel, table, rendu) => {
    etat.tables[table] = { data: rendu, error: null }
    const { data } = await appel()
    expect(data.profile).toEqual({ username: 'Alice', avatar_id: 'av-3' })
    expect(etat.selections.join(' | ')).not.toMatch(/profiles/)
  })

  it('getCommunityProfile : la fiche d’un autre compte se lit', async () => {
    const { profile, error } = await getCommunityProfile('u-alice')
    expect(error).toBeNull()
    expect(profile).toEqual(ALICE)
    expect(appelsProfils()).toEqual([['get_public_profiles', { p_ids: ['u-alice'] }]])
  })

  it('getCommunityProfile : un compte que la base ne rend pas → introuvable, sans erreur', async () => {
    expect(await getCommunityProfile('u-parti')).toEqual({ profile: null, error: null })
  })

  it('getCommunityProfile : la lecture échoue → une erreur, pas « introuvable »', async () => {
    etat.rpc.get_public_profiles = { data: null, error: { message: 'boom' } }
    const { profile, error } = await getCommunityProfile('u-alice')
    expect(profile).toBeNull()
    expect(error).toBeTruthy()
  })
})

describe('les avis lisent leurs auteurs par la fonction publique', () => {
  const AVIS = { id: 'e-1', user_id: 'u-alice', target_recipe_id: 'rec-1', rating: 5, body: 'Parfait' }

  it('loadReviews : chaque avis a le nom de son auteur', async () => {
    etat.tables.engagement = { data: [AVIS], error: null }
    const { reviews, error } = await loadReviews('rec-1', 'base')
    expect(error).toBeNull()
    expect(reviews[0].profile).toEqual({ username: 'Alice', avatar_id: 'av-3' })
    expect(reviews[0].recipe_id).toBe('rec-1')
    expect(etat.selections.join(' | ')).not.toMatch(/profiles/)
  })

  it('getMyReview et upsertReview : l’avis revient avec le nom de son auteur', async () => {
    etat.tables.engagement = { data: AVIS, error: null }
    expect((await getMyReview('u-alice', 'rec-1', 'base')).profile).toEqual({ username: 'Alice', avatar_id: 'av-3' })
    const { data } = await upsertReview('u-alice', { recipeId: 'rec-1', recipeSource: 'base', rating: 5, body: 'Parfait' })
    expect(data.profile).toEqual({ username: 'Alice', avatar_id: 'av-3' })
    expect(etat.selections.join(' | ')).not.toMatch(/profiles/)
  })
})

describe('chercher un compte à signaler (support)', () => {
  it('passe par la fonction de recherche de la base, et rend ce que le panneau affiche', async () => {
    etat.rpc.search_public_profiles = { data: [{ id: 'u-alice', username: 'Alice' }], error: null }
    const resultats = await searchUsersForReport('  ali ')
    expect(etat.appels).toEqual([['search_public_profiles', { p_query: 'ali' }]])
    expect(resultats).toEqual([{ id: 'u-alice', label: 'Alice', emoji: '👤' }])
  })

  it('rien à chercher : aucun appel', async () => {
    expect(await searchUsersForReport('   ')).toEqual([])
    expect(etat.appels).toHaveLength(0)
  })

  it('la recherche échoue : aucune proposition', async () => {
    etat.rpc.search_public_profiles = { data: null, error: { message: 'boom' } }
    expect(await searchUsersForReport('ali')).toEqual([])
  })
})

describe('authorName — trois cas qu’il ne faut pas confondre', () => {
  const t = { deletedAuthor: 'Utilisateur supprimé', authorUnavailable: 'Auteur non chargé' }

  it('le pseudo', () => {
    expect(authorName({ profile: { username: 'Alice' } }, t)).toBe('Alice')
  })
  it('un compte qui n’existe plus', () => {
    expect(authorName({ profile: null }, t)).toBe('Utilisateur supprimé')
  })
  it('une lecture ratée n’est pas un compte supprimé', () => {
    expect(authorName({ profile: null, profileUnavailable: true }, t)).toBe('Auteur non chargé')
  })
})
