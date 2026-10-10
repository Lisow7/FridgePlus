import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Audit du 2026-10-04, BDD-16 (3) : aucun test ne listait les fonctions
// SECURITY DEFINER ouvertes aux visiteurs. Une fonction sous droits du
// définisseur contourne la RLS ; jusqu'au 2026-10-10, toute fonction neuve de
// `public` naissait exécutable par `anon` et `authenticated` (droits par
// défaut du projet) — `admin_delete_notification_batch` l'est restée trois
// mois. Depuis la migration « écritures publiques bornées », les droits par
// défaut ne donnent plus EXECUTE : chaque fonction nouvelle dit à qui elle
// s'ouvre. Ce garde-fou tient le dépôt sur cette discipline : à partir des
// migrations du 2026-10-10, une fonction SECURITY DEFINER du schéma public
// porte, dans le même fichier, son REVOKE … FROM PUBLIC (et donc ses GRANT
// explicites). Les migrations plus anciennes sont de l'histoire.

const DOSSIER = resolve(process.cwd(), 'supabase/migrations')
const DEPUIS = '20261010'
const DEFINITION = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\)[\s\S]*?(?=CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION|$)/gi

function fonctionsDefinerSansRevoke(sql) {
  const fautes = []
  for (const m of sql.matchAll(DEFINITION)) {
    const [bloc, nom] = m
    if (!/SECURITY\s+DEFINER/i.test(bloc)) continue
    const revoke = new RegExp(`REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${nom}\\s*\\([^)]*\\)\\s+FROM\\s+PUBLIC`, 'i')
    if (!revoke.test(sql)) fautes.push(nom)
  }
  return fautes
}

describe('fonctions SECURITY DEFINER — chacune dit à qui elle s’ouvre', () => {
  const recentes = readdirSync(DOSSIER).filter((f) => f.endsWith('.sql') && f.slice(0, 8) >= DEPUIS)

  it('les migrations récentes existent (sinon ce garde-fou ne garde rien)', () => {
    expect(recentes.length).toBeGreaterThan(0)
  })

  it('toute fonction SECURITY DEFINER d’une migration récente porte son REVOKE … FROM PUBLIC', () => {
    const fautes = recentes.flatMap((f) => fonctionsDefinerSansRevoke(readFileSync(resolve(DOSSIER, f), 'utf8')).map((n) => `${f} → ${n}`))
    expect(fautes, 'Ces fonctions naissent sous droits du définisseur sans dire à qui elles s’ouvrent : ajouter REVOKE EXECUTE … FROM PUBLIC puis les GRANT voulus.').toEqual([])
  })

  it('le détecteur voit une fonction sans REVOKE, et laisse passer celle qui l’a', () => {
    const sans = 'CREATE OR REPLACE FUNCTION public.x(a int) RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;'
    const avec = `${sans}\nREVOKE EXECUTE ON FUNCTION public.x(int) FROM PUBLIC;\nGRANT EXECUTE ON FUNCTION public.x(int) TO authenticated;`
    const invoker = 'CREATE FUNCTION public.y() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;'
    expect(fonctionsDefinerSansRevoke(sans)).toEqual(['x'])
    expect(fonctionsDefinerSansRevoke(avec)).toEqual([])
    expect(fonctionsDefinerSansRevoke(invoker)).toEqual([])
  })
})
