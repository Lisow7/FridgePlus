import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { SEO_META } from '@shared/static/seo-meta'
import { laPagePoseSonTitre } from '@routes/route-title'

// Hook qui met à jour les balises SEO du document (title, description,
// og:*, twitter:*) selon la langue active. Sprint 10 S10.a.5 — extrait
// depuis App.jsx pour alléger le composant racine.
//
// Effects côté `<head>` :
//   - document.documentElement.lang
//   - document.title
//   - meta[name=description], og:title, og:description, og:locale,
//     twitter:title, twitter:description
//
// Fallback fr si la langue n'a pas de SEO_META défini.
//
// ── 🔴 SAUF SUR UNE PAGE PRÉ-RENDUE (2026-08-15) ──────────────────────────
// Ce hook est appelé depuis `App.jsx`, donc sur TOUTES les routes, et il écrit
// les métadonnées GÉNÉRIQUES du site. Depuis le pré-rendu des pages recette
// (`scripts/prerender.mjs`), le HTML servi pour `/recipe/:id` porte déjà le
// titre, la description et les `og:*` de LA recette : les écraser au montage
// ferait dire au DOM rendu l'inverse du HTML d'origine.
//
// Les crawlers sociaux n'exécutent pas JS et ne verraient rien de cet
// écrasement — mais Googlebot, lui, l'exécute : il indexerait 515 pages au
// titre identique, c'est-à-dire le défaut même que le pré-rendu corrige.
// Cousin exact du canonical transversal retiré le 2026-08-13.
//
// ── Le signal, et pourquoi il doit être VÉRIFIÉ à chaque navigation ────────
// Une page pré-rendue se reconnaît à son `<link rel="canonical">` : `index.html`
// n'en porte AUCUN (un garde-fou l'interdit — `seo-pas-de-canonical-transversal`)
// et chaque page pré-rendue en pose un.
//
// 🔴 Mais dans une SPA, ce `<link>` SURVIT à la navigation : arriver sur
// `/recipe/pho-boeuf` puis cliquer vers l'accueil laisserait l'accueil porter le
// canonical de la recette — il se déclarerait doublon d'une recette, soit
// EXACTEMENT le bug du 2026-08-13, à l'envers. D'où deux règles :
//   1. le canonical ne fait autorité que s'il décrit la page AFFICHÉE
//      (comparaison de `pathname`) ;
//   2. sinon il est RETIRÉ, avec `og:url`, avant d'appliquer les métadonnées du
//      site — un canonical périmé est pire que pas de canonical.
// Le hook dépend donc aussi du `pathname`, sans quoi il ne se rejouerait qu'au
// changement de langue.
//
// ⚠️ Contrepartie assumée : sur une page recette, changer de langue ne retraduit
// pas le `<title>` (le pré-rendu est en français — cf. la note interne sur le pré-rendu SEO).
// Le CONTENU de la page, lui, suit bien la langue. Poser un titre traduit depuis
// la page recette lèverait cette limite ; c'est un autre chantier.

/**
 * Le canonical présent décrit-il la page actuellement affichée ?
 * Renvoie `false` s'il n'y en a pas, ou s'il a été hérité d'une autre page.
 */
export function canonicalDecritLaPageAffichee(doc = document, pathname = window.location.pathname) {
  const lien = doc.querySelector('link[rel="canonical"]')
  if (!lien) return false
  try {
    return new URL(lien.getAttribute('href'), 'https://fridgeplus.app').pathname === pathname
  } catch {
    return false
  }
}

/** Retire un canonical (et son `og:url`) hérité d'une page précédente. */
export function retirerCanonicalPerime(doc = document) {
  doc.querySelector('link[rel="canonical"]')?.remove()
  doc.querySelector('meta[property="og:url"]')?.remove()
}

export function useSeoMeta(lang) {
  const { pathname } = useLocation()

  useEffect(() => {
    const meta = SEO_META[lang] ?? SEO_META.fr
    // `lang` s'applique dans tous les cas : il décrit la langue AFFICHÉE, que la
    // page soit pré-rendue ou non.
    document.documentElement.lang = lang

    // Page pré-rendue et toujours affichée : elle porte déjà ses propres
    // métadonnées, plus justes que les génériques. Ne rien écraser.
    if (canonicalDecritLaPageAffichee(document, pathname)) return

    // Sinon, un canonical éventuellement présent vient d'une page quittée.
    retirerCanonicalPerime(document)

    // La page pose-t-elle son propre titre ? Alors ne pas l'écraser : cet
    // effet est celui du PARENT, il s'exécute APRÈS celui de la page et
    // gagnerait toujours. Mesuré, cf. laPagePoseSonTitre.
    if (!laPagePoseSonTitre(pathname)) document.title = meta.title

    const setMeta = (selector, attr, value) => {
      const el = document.querySelector(selector)
      if (el) el.setAttribute(attr, value)
    }
    setMeta('meta[name="description"]',         'content', meta.description)
    setMeta('meta[property="og:title"]',        'content', meta.title)
    setMeta('meta[property="og:description"]',  'content', meta.description)
    setMeta('meta[property="og:locale"]',       'content', meta.ogLocale)
    setMeta('meta[name="twitter:title"]',       'content', meta.title)
    setMeta('meta[name="twitter:description"]', 'content', meta.description)
  }, [lang, pathname])
}
