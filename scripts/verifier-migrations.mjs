import fs from 'node:fs'
import path from 'node:path'

// Rapproche les fichiers de supabase/migrations du registre de la base
// (audit du 2026-10-04, ARCH-10 / BDD-19).
//
// Le registre ne se lit pas depuis la CI (pas d'accès à la base) : on le copie
// à la main. Dans l'éditeur SQL de Supabase (ou par l'outil MCP) :
//
//   select string_agg(regexp_replace(name, '^\d{8}_', ''), ' ' order by version)
//   from supabase_migrations.schema_migrations;
//
// puis : node scripts/verifier-migrations.mjs registre.txt   (ou par l'entrée standard)
//
// Sortie : les entrées du registre SANS fichier (à reconstituer depuis la
// colonne `statements`, voir le README) et les fichiers SANS entrée (attendus :
// ceux que le README liste, dont les migrations qui attendent une release).
// Code de sortie 1 s'il manque un fichier.

const source = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : fs.readFileSync(0, 'utf8')
const registre = source.split(/\s+/).map((n) => n.trim()).filter(Boolean)
const dossier = path.resolve(import.meta.dirname, '../supabase/migrations')
const fichiers = fs.readdirSync(dossier).filter((f) => f.endsWith('.sql'))
const nomDuFichier = (f) => f.replace(/\.sql$/, '').replace(/^\d{8}(\d{6})?_/, '')
const noms = new Set(fichiers.map(nomDuFichier))
const enregistres = new Set(registre)

const sansFichier = registre.filter((n) => !noms.has(n))
const sansEntree = fichiers.filter((f) => !enregistres.has(nomDuFichier(f)))

console.log(`registre : ${registre.length} entrée(s) ; dépôt : ${fichiers.length} fichier(s)`)
console.log(`\nentrées du registre SANS fichier : ${sansFichier.length}`)
for (const n of sansFichier) console.log(`  - ${n}`)
console.log(`\nfichiers SANS entrée au registre : ${sansEntree.length} (voir le README pour ceux qui sont attendus)`)
for (const f of sansEntree) console.log(`  - ${f}`)
process.exitCode = sansFichier.length ? 1 : 0
