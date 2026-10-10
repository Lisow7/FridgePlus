// PageSkeleton — fallback Suspense neutre pour les routes lazy.
// Sprint 10 S10.b.2.
//
// Objectif : éviter l'écran blanc instantané entre la requête de route
// et le chargement du chunk JS lazy. Donne un signal visuel/lecteur
// d'écran qu'un contenu arrive.
//
// A11y (WCAG 2.2 + WAI-ARIA APG) :
//   - role="status" + aria-live="polite" → annonce non-bloquante aux
//     lecteurs d'écran (NVDA / VoiceOver / TalkBack).
//   - aria-busy="true"                   → indique zone en chargement.
//   - <span sr-only>Chargement…</span>   → texte i18n pour la voix off.
//
// Reduced motion (vestibular safety, WCAG 2.3.3) :
//   - `motion-safe:animate-pulse` n'applique le shimmer Tailwind QUE si
//     l'utilisateur n'a pas activé `prefers-reduced-motion: reduce`.
//   - En reduced-motion, le skeleton reste statique (toujours visible,
//     mais sans pulsation).
//
// Pourquoi un skeleton plutôt qu'un spinner ou null :
//   - null  → écran blanc, perçu comme bug.
//   - spinner → focus le regard sur l'attente.
//   - skeleton → suggère la structure à venir, perception "rapide".

const LABEL = {
  fr: 'Chargement…',
  en: 'Loading…',
}

export default function PageSkeleton({ lang = 'fr', darkMode = false }) {
  const label = LABEL[lang] ?? LABEL.fr
  const blockBg = darkMode ? 'bg-white/5' : 'bg-black/5'

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="mx-auto w-full max-w-3xl motion-safe:animate-pulse space-y-4 py-8"
    >
      <span className="sr-only">{label}</span>
      <div className={`h-8 w-2/3 rounded-md ${blockBg}`} />
      <div className={`h-4 w-full rounded ${blockBg}`} />
      <div className={`h-4 w-11/12 rounded ${blockBg}`} />
      <div className={`h-4 w-10/12 rounded ${blockBg}`} />
      <div className={`mt-6 h-32 w-full rounded-lg ${blockBg}`} />
      <div className={`h-4 w-9/12 rounded ${blockBg}`} />
      <div className={`h-4 w-8/12 rounded ${blockBg}`} />
    </div>
  )
}
