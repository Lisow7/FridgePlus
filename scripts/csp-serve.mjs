#!/usr/bin/env node
//
// Sert `dist/` en local avec une Content-Security-Policy arbitraire, pour
// éprouver un durcissement AVANT de le déployer.
//
// Pourquoi cet outil : la CSP vit dans les en-têtes de `vercel.json`, que Vite
// ne sert pas. `npm run dev` et `npm run preview` ne l'appliquent donc PAS —
// une CSP cassée ne se découvre qu'en production ou en preview Vercel.
//
// Usage :
//   npm run build
//   node scripts/csp-serve.mjs                       # CSP lue depuis vercel.json
//   node scripts/csp-serve.mjs "default-src 'self'"  # CSP explicite
//
// Puis ouvrir http://localhost:4399/FridgePlus/ et lire la console : toute
// violation y apparaît en erreur.
//
// ⚠️ Ce serveur ne charge PAS `vercel.live` : la barre d'outils des previews
// Vercel n'est donc jamais testée ici. Un durcissement de `script-src` doit
// être vérifié sur une preview réelle avant merge.
//
// 2026-08-06 — créé pour le retrait de `'unsafe-inline'` de `script-src`
// (note d'audit repo §4). Garde-fou associé : src/test/unit/csp-policy.test.js

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const PORT = 4399

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
}

function cspFromVercelJson() {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'))
  const header = (config.headers ?? [])
    .flatMap(entry => entry.headers ?? [])
    .find(h => h.key === 'Content-Security-Policy')
  if (!header) throw new Error('Aucun Content-Security-Policy dans vercel.json')
  // `upgrade-insecure-requests` forcerait https sur localhost → page injoignable.
  return header.value.replace(/;\s*upgrade-insecure-requests/, '')
}

if (!fs.existsSync(DIST)) {
  console.error('dist/ absent — lancer `npm run build` d\'abord.')
  process.exit(1)
}

const csp = process.argv[2] ?? cspFromVercelJson()

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]).replace(/^\/FridgePlus/, '')
  let file = path.join(DIST, urlPath === '/' || urlPath === '' ? '/index.html' : urlPath)
  // SPA : toute route inconnue retombe sur index.html.
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')

  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
    'Content-Security-Policy': csp,
  })
  res.end(fs.readFileSync(file))
}).listen(PORT, () => {
  console.log(`CSP appliquée :\n  ${csp}\n`)
  console.log(`→ http://localhost:${PORT}/FridgePlus/`)
})
