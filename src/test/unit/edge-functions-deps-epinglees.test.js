import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

// Garde-fou : les dépendances des Edge Functions doivent être épinglées à une
// version EXACTE, et toutes les fonctions doivent s'accorder sur la même.
//
// CE QUI ÉTAIT EN PLACE JUSQU'AU 2026-08-13
//   17 × 'https://esm.sh/@supabase/supabase-js@2'   ← majeur seulement
//    3 × 'https://esm.sh/stripe@14'                 ← majeur seulement
// Soit 20 imports sur 24 qui laissaient le résolveur choisir n'importe quel
// 2.x / 14.x AU MOMENT DU DÉPLOIEMENT. Ces fonctions portent l'authentification,
// la modération de contenu, les webhooks Stripe et la purge RGPD : une version
// cassée ou compromise y serait entrée sans aucune revue, et deux déploiements
// du même code pouvaient ne pas se comporter pareil.
//
// ⚠️ CE QUE L'ÉPINGLAGE N'APPORTE PAS
// Il ne rend PAS le déploiement reproductible au sens strict : esm.sh résout
// encore les dépendances transitives à sa main. Il supprime la plus grosse
// source de dérive, pas toutes.
//
// ⚠️ SON COÛT, RÉEL
// Une version épinglée ne reçoit plus les correctifs du majeur, et
// **dependabot ne surveille pas les URL `esm.sh`** — rien n'ouvrira jamais de PR
// pour ces lignes. Le rafraîchissement est donc MANUEL et volontaire.
//
// POURQUOI PAS UN MODULE `_shared/deps.ts` PARTAGÉ
// Ce serait le remède habituel contre 17 copies. Il a été écarté ici : tout
// changement dans ce dossier impose de redéployer 17 fonctions, et modifier la
// résolution de modules y ajouterait un risque que ce test couvre autrement —
// la règle d'UNIFORMITÉ ci-dessous interdit la divergence sans toucher au
// chargement.

const RACINE = resolve(process.cwd(), 'supabase/functions')

const SPEC = /from\s+['"]((?:https?:\/\/|npm:)[^'"]+)['"]/g

// Découpe une spécification en { paquet, version }.
//
// ⚠️ Le piège, rencontré en écrivant ce test : on ne peut PAS couper au premier
// `@`. Dans `https://esm.sh/@supabase/supabase-js@2.112.3`, le premier `@` est
// celui du SCOPE npm — une première version de ce test signalait donc les 17
// imports comme non épinglés alors qu'ils venaient d'être corrigés. C'est le
// DERNIER `@` qui porte la version.
//
// Autre cas à tenir : `https://deno.land/std@0.168.0/http/server.ts` place sa
// version au MILIEU du chemin — d'où la coupe au premier `/` qui suit.
function decoupe(spec) {
  const i = spec.lastIndexOf('@')
  if (i <= 0) return { paquet: spec, version: null }
  return { paquet: spec.slice(0, i), version: spec.slice(i + 1).split('/')[0] }
}

// « Épinglée » = la version porte au moins un point : `2.112.3` oui, `2` non.
const estEpinglee = (v) => !!v && v.includes('.')

function fichiersFonctions(dossier, acc = []) {
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) fichiersFonctions(chemin, acc)
    else if (/\.ts$/.test(entree)) acc.push(chemin)
  }
  return acc
}

function imports() {
  const trouves = []
  for (const fichier of fichiersFonctions(RACINE)) {
    const contenu = readFileSync(fichier, 'utf8')
    const relatif = fichier.replace(process.cwd(), '').replace(/\\/g, '/').replace(/^\//, '')
    for (const m of contenu.matchAll(SPEC)) {
      trouves.push({ fichier: relatif, ...decoupe(m[1]) })
    }
  }
  return trouves
}

describe('Edge Functions — dépendances épinglées', () => {
  const tous = imports()

  it('le test voit bien des imports (sinon il serait aveugle)', () => {
    expect(tous.length).toBeGreaterThan(15)
  })

  it('aucune dépendance épinglée au majeur seulement', () => {
    const flous = tous
      .filter(i => !estEpinglee(i.version))
      .map(i => `${i.fichier} → ${i.paquet}@${i.version ?? '(aucune version)'}`)
    expect(
      flous,
      'Une version au majeur seul laisse le résolveur choisir AU DÉPLOIEMENT :\n  - ' +
      flous.join('\n  - '),
    ).toEqual([])
  })

  it('toutes les fonctions s’accordent sur la même version d’un paquet donné', () => {
    // Remplace le module `_shared/deps.ts` : interdit qu'une fonction parte
    // seule sur une autre version — le défaut « deux copies qui divergent ».
    const parPaquet = new Map()
    for (const i of tous) {
      if (!parPaquet.has(i.paquet)) parPaquet.set(i.paquet, new Set())
      parPaquet.get(i.paquet).add(i.version)
    }
    const divergents = [...parPaquet.entries()]
      .filter(([, versions]) => versions.size > 1)
      .map(([paquet, versions]) => `${paquet} : ${[...versions].join(' vs ')}`)
    expect(divergents).toEqual([])
  })
})
