/**
 * Génère src/shared/types/database.ts depuis le schéma Supabase de prod.
 *
 * Lit VITE_SUPABASE_URL depuis .env.local, extrait le project-ref et appelle
 * `supabase gen types typescript --project-id <ref>`. Le project-ref est public
 * (visible dans l'URL Supabase), pas un secret.
 *
 * À relancer après chaque migration SQL appliquée en prod.
 *
 * Prérequis : VITE_SUPABASE_URL dans .env.local + supabase CLI (devDep).
 * Usage : npm run db:types
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const envFile = join(root, '.env.local')
  if (!existsSync(envFile)) return {}
  const env = {}
  for (const line of readFileSync(envFile, 'utf-8').split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const env = { ...loadEnv(), ...process.env }
const SUPABASE_URL = env.VITE_SUPABASE_URL

if (!SUPABASE_URL) {
  console.error('❌ VITE_SUPABASE_URL manquant dans .env.local')
  process.exit(1)
}

const match = SUPABASE_URL.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)
if (!match) {
  console.error(`❌ Impossible d'extraire le project-ref depuis "${SUPABASE_URL}"`)
  console.error('   Format attendu : https://<project-ref>.supabase.co')
  process.exit(1)
}

const projectRef = match[1]
const outDir = join(root, 'src/shared/types')
const outFile = join(outDir, 'database.ts')

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

console.log(`→ Génération des types TypeScript pour le projet ${projectRef}…`)

try {
  const types = execSync(
    `npx supabase gen types typescript --project-id ${projectRef} --schema public`,
    { encoding: 'utf-8', cwd: root, stdio: ['pipe', 'pipe', 'inherit'] }
  )
  writeFileSync(outFile, types, 'utf-8')
  console.log(`✓ Types écrits dans src/shared/types/database.ts (${types.length} caractères)`)
} catch (err) {
  console.error('❌ Échec de la génération.')
  console.error(`   Détail : ${err.message}`)
  console.error('   Vérifie que tu es loggé : npx supabase login')
  process.exit(1)
}
