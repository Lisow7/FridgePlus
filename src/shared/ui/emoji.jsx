import { useState } from 'react'
import { getFluentEmojiUrl } from '@shared/static/fluent-emoji-map'
import { optimizeStorageImage } from '@shared/lib/images/optimize-storage-image'
import { isProjectStorageUrl } from '@shared/lib/images/trusted-image-url'

// Images HÉBERGÉES PAR LE SITE (public/emoji/twemoji/, Twemoji 14.0.2, CC-BY
// 4.0) : elles étaient demandées au CDN de jsDelivr, qui recevait l'adresse IP
// de chaque visiteur (décision du 2026-10-06, « emoji = sur_le_site »).
// Un emoji sans fichier ici retombe sur l'emoji du système, sans autre requête.
const TWEMOJI = `${import.meta.env.BASE_URL}emoji/twemoji`

function toTwemojiUrl(char) {
  const cp = [...char]
    .map(c => c.codePointAt(0).toString(16))
    .filter(c => c !== 'fe0f' && c !== 'fe0e')
    .join('-')
  return `${TWEMOJI}/${cp}.svg`
}

// A11y fix critique (Sprint 2 PR S2.a).
// Avant : `alt={char}` sur tous les emojis → screen reader lisait
// "tomate emoji" pour chaque card recette, badge, ingrédient, etc.
// Conséquence : app inutilisable pour utilisateurs lecteur d'écran.
//
// Après : par défaut `alt=""` + `aria-hidden="true"` (emoji décoratif,
// le texte adjacent suffit). Si l'emoji porte une information sémantique
// utile (ex : drapeau pays, badge plan), passer une `label` explicite
// pour le rendre lisible : `<Emoji char="🇫🇷" label="France" />`.
//
// Icons Overhaul P1 (2026-05-19) — Nouveau prop `imageUrl` optionnel :
// si fourni, on affiche l'illustration personnalisée (ingredient.image_url
// ou recipe.image_url) à la place de l'emoji Twemoji. Fallback automatique
// sur Twemoji si l'image custom fail (404, CORS, etc.). Rétro-compat 100% :
// les call sites sans imageUrl continuent de marcher comme avant.
//
// Icons Overhaul P4 (2026-05-19) — Fluent Emoji 3D (Microsoft, MIT) inséré
// entre imageUrl custom et Twemoji. Cohérence visuelle avec nos images IA
// gpt-image-1 (style "flat 3D-soft"). Cascade complète :
//   1. imageUrl custom BDD (123 items générés)
//   2. Fluent Emoji (~100 emojis communs mappés), hébergés par le site
//   3. Twemoji (fallback pour les emojis non mappés), hébergés par le site
//   4. Texte natif OS (ultime)

export default function Emoji({ char, size = 24, style, className, label, imageUrl }) {
  const [customFailed, setCustomFailed] = useState(false)
  const [fluentFailed, setFluentFailed] = useState(false)
  const [twemojiFailed, setTwemojiFailed] = useState(false)
  // Si `label` fourni → emoji informatif. Sinon → décoratif (alt vide).
  const a11yProps = label
    ? { 'aria-label': label, role: 'img' }
    : { 'aria-hidden': 'true' }

  const fluentUrl = char ? getFluentEmojiUrl(char) : null

  // Une image qui ne vient pas du stockage public du projet est ignorée : le
  // navigateur ne contacte jamais l'hôte choisi par l'auteur d'une recette
  // (audit 2026-10-04, SEC-15). Repli normal sur l'emoji.
  const useCustom  = isProjectStorageUrl(imageUrl) && !customFailed
  const useFluent  = !useCustom && fluentUrl && !fluentFailed
  const useTwemoji = !useCustom && !useFluent && char && !twemojiFailed

  if (!useCustom && !useFluent && !useTwemoji) {
    // Fallback ultime : texte natif (emoji système OS)
    return (
      <span
        style={{ fontSize: size * 0.85, lineHeight: 1, display: 'inline-block', flexShrink: 0, ...style }}
        className={className}
        {...a11yProps}
      >
        {char}
      </span>
    )
  }

  let src
  if (useCustom)       src = optimizeStorageImage(imageUrl, size) // perf : variante redimensionnée
  else if (useFluent)  src = fluentUrl
  else                 src = toTwemojiUrl(char)

  return (
    <img
      src={src}
      alt={label ?? ''}
      width={size}
      height={size}
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={() => {
        // Cascade : custom → Fluent → Twemoji → texte natif
        if (useCustom)        setCustomFailed(true)
        else if (useFluent)   setFluentFailed(true)
        else                  setTwemojiFailed(true)
      }}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      className={className}
      {...a11yProps}
    />
  )
}
