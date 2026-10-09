import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

// Garde-fou : une colonne protégée par `guard_profiles_privileged_columns()`
// ne doit JAMAIS être écrite par le client sur `profiles`.
//
// CE QUI EST ARRIVÉ (2026-08-08 → prouvé faux le 2026-08-12)
// La migration `20260808_guard_profiles_columns_restantes.sql` ajoutait
// `deleted_at` et `restore_token` à la branche UPDATE du garde, en affirmant
// qu'ils n'étaient « JAMAIS écrits par le client ». Or
// `auth-provider.jsx:127-140` les écrit tous les deux : c'est l'auto-restore
// d'un compte soft-deleted quand l'utilisateur revient dans les 30 jours.
// L'appliquer aurait bloqué la restauration — et SILENCIEUSEMENT, l'erreur
// n'étant journalisée que sous `import.meta.env.DEV`. L'utilisateur se serait
// cru revenu, son compte serait resté programmé pour purge.
//
// Prouvé par dry-run sur la base réelle : `AUTO-RESTORE = BLOQUÉ (42501)`.
//
// CE QUE CE TEST FAIT
// Il croise deux sources qui ne se parlent pas : les colonnes protégées dans le
// SQL, et les colonnes réellement écrites depuis `src/`. Toute intersection est
// un bug — soit le garde protège trop, soit le client écrit ce qu'il ne devrait
// pas. Dans les deux cas il faut trancher à la main, pas au hasard.
//
// ⚠️ CE QU'IL NE FAIT PAS
// Il lit le DÉPÔT, pas la base. Il reste vert si la migration n'a jamais été
// appliquée — l'état réel se lit dans `supabase/migrations/README.md`.
//
// Et il ne voit que les objets écrits en clair : `updateProfile({ champ: … })`
// ou `.update({ champ: … })`. Un appel qui passe une variable —
// `updateProfile(patch)` — lui échapperait. Vérifié le 2026-08-12 : aucun des
// 14 appels ne le fait, tous portent des clés littérales. Si un jour l'un d'eux
// construit son objet, ce test cesse silencieusement de couvrir ce chemin.

// 🔴 La migration lue ici doit être celle qui porte la DERNIÈRE définition du
// garde. Depuis le 2026-10-04 c'est `20261004_inscription_sans_impasse.sql`
// (les dates de preuve d'acceptation peuvent passer de vide à « maintenant ») ;
// lire encore celle du 8 août aurait gardé ce test vert sur une définition que
// la base n'exécute plus.
const MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261004_inscription_sans_impasse.sql',
)
const RACINE_SRC = resolve(process.cwd(), 'src')

// Les colonnes de la branche UPDATE uniquement. La branche INSERT protège
// légitimement `deleted_at`/`restore_token` : un INSERT n'est pas un UPDATE, et
// aucun `.from('profiles').insert(` n'existe côté client.
function colonnesProtegeesEnUpdate(sql) {
  const apresInsert = sql.split(/IF TG_OP = 'INSERT' THEN/)[1] ?? ''
  const brancheUpdate = apresInsert.split(/RETURN NEW;\s*END IF;/)[1] ?? ''
  return [...brancheUpdate.matchAll(/NEW\.(\w+)\s+IS DISTINCT FROM OLD\.\1/g)]
    .map(m => m[1])
}

function fichiersSource(dossier, acc = []) {
  for (const entree of readdirSync(dossier)) {
    if (entree === 'node_modules' || entree === 'test') continue
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) fichiersSource(chemin, acc)
    else if (/\.(js|jsx)$/.test(entree)) acc.push(chemin)
  }
  return acc
}

// Colonnes écrites par le client sur `profiles`. Deux chemins :
//   1. `.from('profiles')` suivi d'un `.update({ … })` / `.upsert({ … })` ;
//   2. `updateProfile({ … })`, qui cible toujours `profiles`.
function colonnesEcritesParLeClient() {
  const trouvees = new Map() // colonne -> "fichier:ligne"

  for (const fichier of fichiersSource(RACINE_SRC)) {
    const contenu = readFileSync(fichier, 'utf8')
    const relatif = fichier.replace(process.cwd(), '').replace(/\\/g, '/').replace(/^\//, '')

    const noteCles = (bloc, index) => {
      const ligne = contenu.slice(0, index).split('\n').length
      for (const m of bloc.matchAll(/(\w+)\s*:/g)) {
        if (!trouvees.has(m[1])) trouvees.set(m[1], `${relatif}:${ligne}`)
      }
    }

    // 1. from('profiles') … .update({ … })  (le `.update` peut être 3 lignes plus bas)
    for (const m of contenu.matchAll(/from\(\s*['"]profiles['"]\s*\)[\s\S]{0,200}?\.(?:update|upsert)\(\s*\{([^}]*)\}/g)) {
      noteCles(m[1], m.index)
    }

    // 2. updateProfile({ … }) — l'helper d'`auth-provider`, toujours sur profiles
    for (const m of contenu.matchAll(/updateProfile\(\s*\{([^}]*)\}/g)) {
      noteCles(m[1], m.index)
    }
  }
  return trouvees
}

describe('garde `profiles` — aucune colonne protégée n’est écrite par le client', () => {
  const sql = readFileSync(MIGRATION, 'utf8')
  const protegees = colonnesProtegeesEnUpdate(sql)
  const ecrites = colonnesEcritesParLeClient()

  it('la branche UPDATE du garde est bien lue (sinon le test serait aveugle)', () => {
    expect(protegees.length).toBeGreaterThan(5)
    expect(protegees).toContain('role')
  })

  it('les écritures client sur `profiles` sont bien détectées (sinon idem)', () => {
    // Témoins : deux écritures légitimes et bien réelles du client.
    expect([...ecrites.keys()]).toContain('last_login_at')
    expect([...ecrites.keys()]).toContain('deleted_at')
  })

  it('aucune colonne protégée en UPDATE n’est écrite par le client', () => {
    const conflits = protegees
      .filter(col => ecrites.has(col))
      .map(col => `${col} (écrit en ${ecrites.get(col)})`)

    expect(
      conflits,
      `Colonnes à la fois protégées par le garde et écrites par le client :\n  - ${conflits.join('\n  - ')}\n` +
      'Soit le garde protège trop (le client a un besoin légitime), soit le client\n' +
      "écrit ce qu'il ne devrait pas. À trancher à la main — voir l'en-tête de la migration.",
    ).toEqual([])
  })
})
