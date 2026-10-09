import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// Garde-fou : chaque colonne que le code ÉCRIT ou LIT en toutes lettres existe
// dans la base, et chaque insertion écrite en toutes lettres porte les colonnes
// OBLIGATOIRES de sa table.
//
// ── Pourquoi ce test existe ───────────────────────────────────────────────
// Trouvé le 2026-10-05 : les quatre fonctions de signalement de la communauté
// et des avis écrivaient `support_tickets.body` — une colonne qui n'existe pas —
// et oubliaient `title`, obligatoire. AUCUN signalement n'avait jamais abouti.
// Les tests unitaires simulent la base : une colonne fantôme y passe sans bruit.
// Ce test, lui, confronte le code aux types de la VRAIE base
// (`src/shared/types/database.ts`, régénéré après chaque migration).
//
// ── Ce qu'il voit, et ce qu'il ne voit pas ────────────────────────────────
// Pour chaque `.from('table')` : les clés d'un objet littéral passé à
// `.insert(` / `.update(` / `.upsert(`, les colonnes simples d'un
// `.select('a, b')`, et la colonne des filtres (`.eq('col', …)`, `.order(…)`…).
// Ce qui est construit à l'exécution (objet calculé, `...spread`, sélection
// dynamique, jointures `table(col)`) n'est pas vérifiable ici : compté à part.

const RACINE = process.cwd()
const DOSSIERS = ['src', 'supabase/functions']
const FILTRES = ['eq', 'neq', 'in', 'is', 'gt', 'gte', 'lt', 'lte', 'order', 'like', 'ilike', 'not', 'contains', 'overlaps']

// ── Les colonnes de chaque table et vue, et celles qu'une insertion DOIT fournir ──
function lireLaBase() {
  const lignes = readFileSync(resolve(RACINE, 'src/shared/types/database.ts'), 'utf8').split(/\r?\n/)
  const debut = lignes.findIndex((l) => /^ {4}Tables: \{$/.test(l))
  const fin = lignes.findIndex((l) => /^ {4}Functions: \{$/.test(l))
  const colonnes = new Map()
  const obligatoires = new Map()
  let relation = null; let dansRow = false; let dansInsert = false
  for (const ligne of lignes.slice(debut + 1, fin)) {
    const nom = ligne.match(/^ {6}(\w+): \{$/)
    if (nom) { relation = nom[1]; colonnes.set(relation, new Set()); obligatoires.set(relation, new Set()); dansRow = false; dansInsert = false; continue }
    if (/^ {8}Row: \{$/.test(ligne)) { dansRow = true; continue }
    if (/^ {8}Insert: \{$/.test(ligne)) { dansInsert = true; continue }
    if (/^ {8}\}$/.test(ligne)) { dansRow = false; dansInsert = false; continue }
    const colonne = dansRow && ligne.match(/^ {10}(\w+)\??:/)
    if (colonne) colonnes.get(relation).add(colonne[1])
    // Dans `Insert:`, une colonne SANS « ? » n'a ni valeur par défaut ni NULL permis.
    const requise = dansInsert && ligne.match(/^ {10}(\w+):/)
    if (requise) obligatoires.get(relation).add(requise[1])
  }
  return { colonnes, obligatoires }
}

// ── Un petit lecteur de code : sauter chaînes, gabarits et commentaires ───
function finDeChaine(s, i) {
  const q = s[i]
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue }
    if (q === '`' && s[j] === '$' && s[j + 1] === '{') { j = finEquilibree(s, j + 1); continue }
    if (s[j] === q) return j
  }
  return s.length - 1
}
// `i` est sur une ouvrante ( [ { : rend l'indice de sa fermante.
function finEquilibree(s, i) {
  const paires = { '(': ')', '[': ']', '{': '}' }
  const pile = [paires[s[i]]]
  for (let j = i + 1; j < s.length; j++) {
    const c = s[j]
    if (c === '"' || c === "'" || c === '`') { j = finDeChaine(s, j); continue }
    if (c === '/' && s[j + 1] === '/') { while (j < s.length && s[j] !== '\n') j++; continue }
    if (c === '/' && s[j + 1] === '*') { j = s.indexOf('*/', j + 2) + 1; continue }
    if (paires[c]) { pile.push(paires[c]); continue }
    if (c === pile[pile.length - 1]) { pile.pop(); if (pile.length === 0) return j }
  }
  return s.length - 1
}
// Les clés de premier niveau d'un objet littéral `{ … }`.
function clesDePremierNiveau(objet) {
  const cles = []; let dynamique = false
  let i = 1
  const sauterBlancs = () => {
    for (;;) {
      while (i < objet.length && /[\s,]/.test(objet[i])) i++
      if (objet[i] === '/' && objet[i + 1] === '/') { while (i < objet.length && objet[i] !== '\n') i++; continue }
      if (objet[i] === '/' && objet[i + 1] === '*') { i = objet.indexOf('*/', i + 2) + 2; continue }
      return
    }
  }
  while (i < objet.length - 1) {
    sauterBlancs()
    if (i >= objet.length - 1) break
    if (objet.startsWith('...', i)) { dynamique = true; i += 3 }
    else if (objet[i] === '[') { dynamique = true; i = finEquilibree(objet, i) + 1 }
    else {
      let cle
      if (objet[i] === '"' || objet[i] === "'") { const f = finDeChaine(objet, i); cle = objet.slice(i + 1, f); i = f + 1 }
      else { const m = /^[A-Za-z_$][\w$]*/.exec(objet.slice(i)); if (!m) { i++; continue } cle = m[0]; i += cle.length }
      cles.push(cle)
      while (i < objet.length && /\s/.test(objet[i])) i++
      if (objet[i] !== ':') continue   // raccourci `{ cle, … }`
      i++
    }
    while (i < objet.length - 1 && objet[i] !== ',') {
      const c = objet[i]
      if (c === '"' || c === "'" || c === '`') i = finDeChaine(objet, i) + 1
      else if (c === '(' || c === '[' || c === '{') i = finEquilibree(objet, i) + 1
      else if (c === '/' && objet[i + 1] === '/') { while (i < objet.length && objet[i] !== '\n') i++ }
      else if (c === '/' && objet[i + 1] === '*') i = objet.indexOf('*/', i + 2) + 2
      else i++
    }
  }
  return { cles, dynamique }
}

// Balaie UN fichier. Rend les colonnes fantômes et les colonnes obligatoires oubliées.
function balayer(texte, nomFichier, { colonnes, obligatoires }) {
  const fantomes = []; const oubliees = []; let verifiees = 0
  const re = /\.from\(\s*(['"])([a-z_0-9]+)\1\s*\)/g
  let m
  while ((m = re.exec(texte))) {
    const table = m[2]
    const connues = colonnes.get(table)
    if (!connues) continue   // relation hors des types (schéma privé, texte d'un commentaire…)
    let suite = texte.slice(m.index + m[0].length, m.index + m[0].length + 1500)
    const coupe = suite.search(/\.from\(|\bsupabase\b|\n\s*\n|\bawait\b|\bconst\b|\breturn\b|\bif\s*\(/)
    if (coupe > 0) suite = suite.slice(0, coupe)
    const debutSuite = m.index + m[0].length
    const appel = /\.\s*(insert|update|upsert|select|eq|neq|in|is|gt|gte|lt|lte|order|like|ilike|not|contains|overlaps)\s*\(/g
    let a
    while ((a = appel.exec(suite))) {
      const methode = a[1]
      const ouvrante = a.index + a[0].length - 1
      const fermante = finEquilibree(suite, ouvrante)
      const args = suite.slice(ouvrante + 1, fermante).trim()
      const ligne = texte.slice(0, debutSuite + a.index).split('\n').length
      const lieu = `${nomFichier}:${ligne}`
      const noter = (colonne, quoi) => {
        verifiees++
        if (!connues.has(colonne)) fantomes.push(`${lieu}  ${table}.${colonne}  (${quoi})`)
      }
      if (['insert', 'update', 'upsert'].includes(methode)) {
        let objet = args
        if (objet.startsWith('[')) objet = objet.slice(1).trim()
        if (objet.startsWith('{')) {
          const { cles, dynamique } = clesDePremierNiveau(objet.slice(0, finEquilibree(objet, 0) + 1))
          for (const cle of cles) noter(cle, `écrite par .${methode}`)
          if (methode === 'insert' && !dynamique) {
            for (const requise of obligatoires.get(table) ?? []) {
              if (!cles.includes(requise)) oubliees.push(`${lieu}  ${table}.${requise}  (obligatoire, absente de l'insertion)`)
            }
          }
        }
      } else if (methode === 'select') {
        const lit = /^(['"`])([^'"`$]*)\1/.exec(args)
        if (lit) {
          for (const morceau of lit[2].split(',')) {
            const col = morceau.trim()
            if (!col || col === '*' || /[():!.>\s]/.test(col)) continue
            noter(col, 'lue par .select')
          }
        }
      } else if (FILTRES.includes(methode)) {
        const lit = /^(['"])([a-z_0-9]+)\1/.exec(args)
        if (lit) noter(lit[2], `citée par .${methode}`)
      }
      appel.lastIndex = fermante + 1
    }
  }
  return { fantomes, oubliees, verifiees }
}

function fichiers(dossier, sortie = []) {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const p = join(dossier, e.name)
    if (e.isDirectory()) { if (!/^(test|types|node_modules)$/.test(e.name)) fichiers(p, sortie); continue }
    if (/\.(jsx?|ts)$/.test(e.name)) sortie.push(p)
  }
  return sortie
}

describe('les colonnes que le code écrit et lit existent dans la base', () => {
  const base = lireLaBase()

  it('les types de la base sont bien lus (sinon ce test serait aveugle)', () => {
    expect(base.colonnes.size).toBeGreaterThan(30)
    expect(base.colonnes.get('support_tickets')).toContain('title')
    expect(base.obligatoires.get('support_tickets')).toContain('title')
    expect(base.obligatoires.get('support_tickets')).not.toContain('status')   // a une valeur par défaut
  })

  it('le balayage voit bien une colonne fantôme et une colonne obligatoire oubliée (témoin)', () => {
    const code = `await supabase.from('support_tickets').insert({ user_id: u, type: 'report', body: 'x' })`
    const { fantomes, oubliees } = balayer(code, 'temoin.js', base)
    expect(fantomes).toEqual(['temoin.js:1  support_tickets.body  (écrite par .insert)'])
    expect(oubliees).toEqual(['temoin.js:1  support_tickets.title  (obligatoire, absente de l\'insertion)'])
  })

  it('aucune colonne fantôme, aucune colonne obligatoire oubliée', () => {
    const fantomes = []; const oubliees = []; let verifiees = 0
    for (const dossier of DOSSIERS) {
      for (const fichier of fichiers(resolve(RACINE, dossier))) {
        const r = balayer(readFileSync(fichier, 'utf8'), relative(RACINE, fichier).replace(/\\/g, '/'), base)
        fantomes.push(...r.fantomes); oubliees.push(...r.oubliees); verifiees += r.verifiees
      }
    }
    expect(verifiees, 'le balayage doit vérifier des centaines de colonnes').toBeGreaterThan(500)
    expect(fantomes, `colonnes qui n'existent pas dans la base :\n${fantomes.join('\n')}`).toEqual([])
    expect(oubliees, `insertions sans une colonne obligatoire :\n${oubliees.join('\n')}`).toEqual([])
  })
})
