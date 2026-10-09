import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Garde-fou : une vue refaite par CREATE OR REPLACE perd `security_invoker`.
//
// CE QUI EST ARRIVÉ (2026-07-27 → constaté le 2026-08-09)
// `recipe_health_check` était en `security_invoker = on` depuis mai 2026 —
// quatre migrations successives reposaient l'option juste après le CREATE. La
// cinquième, qui réparait la vue cassée en production, refait un
// `create or replace view` SANS reposer l'option. Postgres a rendu la vue à son
// défaut : SECURITY DEFINER, donc la RLS de `recipes_unified` ne s'applique plus
// à l'appelant. Les advisors Supabase, à 0 ERROR le 2026-06-21, en signalaient
// un le 2026-08-09.
//
// La vue est en GRANT SELECT à `anon` et ne filtre que `deleted_at IS NULL` :
// ni `status`, ni `origin`, ni `user_id`. Aucune fuite constatable au moment de
// la mesure (la base ne contenait que des recettes officielles publiées), mais
// la première recette utilisateur en brouillon devenait lisible sans compte.
//
// POURQUOI UN TEST SUR LES FICHIERS ET NON SUR LA BASE
// La CI ne parle pas au vrai Supabase. Ce test garde donc l'INTENTION exprimée
// par le dépôt, ce qui suffit à attraper la faute : oublier l'ALTER en refaisant
// la vue. Il ne remplace pas les advisors, qui eux mesurent le réel — les deux
// sont complémentaires, et c'est l'advisor qui a trouvé celui-ci.
//
// LE CRITÈRE EST CHRONOLOGIQUE, PAS « MÊME FICHIER »
// Première version essayée : exiger l'ALTER dans le fichier du CREATE. Trois
// faux positifs — `custom_recipes` et `ai_usage_daily_summary` reçoivent leur
// option dans une migration ULTÉRIEURE dédiée, ce qui est parfaitement valide.
// On compare donc, par vue, le rang du dernier CREATE au rang du dernier ALTER.

const DOSSIER = 'supabase/migrations'

// `base_recipes` porte bien `security_invoker=true` EN BASE (mesuré le
// 2026-08-09 via pg_class.reloptions), mais aucune migration du dépôt ne la
// pose : l'option a été appliquée hors dépôt. On ne la réclame donc pas ici —
// exiger un ALTER pour une vue déjà conforme en production ferait échouer la
// suite sans rien corriger. ⚠️ C'est un écart dépôt/BDD connu, pas un oubli à
// rattraper : si cette vue est un jour refaite par migration, l'option devra y
// être reposée et cette exception retirée.
const HORS_DEPOT = new Set(['base_recipes'])

// Les commentaires SQL doivent sauter avant analyse : « -- la vue de X » faisait
// détecter la création d'une vue nommée « de ».
const sansCommentaires = s => s.replace(/--[^\n]*/g, '')

function releve() {
  const dir = resolve(process.cwd(), DOSSIER)
  const fichiers = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  const dernierCreate = new Map()
  const dernierInvoker = new Map()

  fichiers.forEach((f, rang) => {
    const sql = sansCommentaires(readFileSync(resolve(dir, f), 'utf8'))
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?([a-z0-9_]+)/gi)) {
      dernierCreate.set(m[1], { rang, f })
    }
    for (const m of sql.matchAll(/alter\s+view\s+(?:public\.)?([a-z0-9_]+)\s+set\s*\(\s*security_invoker/gi)) {
      dernierInvoker.set(m[1], { rang, f })
    }
  })

  return { dernierCreate, dernierInvoker }
}

describe('migrations — les vues gardent security_invoker', () => {
  it('aucune vue n\'est refaite après la dernière pose de security_invoker', () => {
    const { dernierCreate, dernierInvoker } = releve()

    const perdues = [...dernierCreate]
      .filter(([vue]) => !HORS_DEPOT.has(vue))
      .filter(([vue, creation]) => {
        const pose = dernierInvoker.get(vue)
        return !pose || pose.rang < creation.rang
      })
      .map(([vue, creation]) => {
        const pose = dernierInvoker.get(vue)
        return pose
          ? `${vue} : refaite par ${creation.f} APRÈS la pose de ${pose.f}`
          : `${vue} : créée par ${creation.f}, security_invoker jamais posé`
      })

    expect(
      perdues,
      'Ces vues perdent `security_invoker` : un CREATE OR REPLACE remet une vue '
      + 'à son défaut SECURITY DEFINER, ce qui contourne la RLS des tables '
      + 'sous-jacentes pour tout appelant. Ajouter `ALTER VIEW public.<vue> SET '
      + '(security_invoker = on);` dans la migration qui refait la vue.',
    ).toEqual([])
  })

  it('l\'exception HORS_DEPOT ne couvre que des vues réellement créées', () => {
    const { dernierCreate } = releve()
    const fantomes = [...HORS_DEPOT].filter(vue => !dernierCreate.has(vue))

    expect(
      fantomes,
      'Ces entrées de HORS_DEPOT ne correspondent à aucune vue créée par une '
      + 'migration : la liste a dérivé, la retirer.',
    ).toEqual([])
  })
})
