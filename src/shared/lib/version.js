// Sprint 3 perf pré-launch — PR S3.a.
//
// Version courante extraite de `changelog.js` (8197 lignes, ~671 KB) pour
// éviter d'embarquer tout le tableau CHANGELOG dans le bundle initial.
// Avant : `sentry.js` importait `CURRENT_VERSION` depuis `changelog.js`,
// déclenchant le tree-shake KO de tout le tableau via `auth-provider`
// (chunk init = 620 KiB / 228 KiB gzip). Après : -200 KiB gzip sur init.
//
// ⚠️ BUMP SEULEMENT au dev→main (release prod). Les PR de `dev` ne touchent PAS
// cette version : le badge du footer ne change qu'à la mise en prod. Voir la
// politique en tête de `changelog.js`.

export const CURRENT_VERSION = '0.145'

// Le nom de la dernière version, pour le badge du pied de page. Lu ici, pas
// dans le journal : le journal complet (85 Ko) partait au démarrage de chaque
// page pour ces deux lignes (audit du 2026-10-04, PERF-04).
// ⚠️ À la release, avec CURRENT_VERSION : un test les tient égaux à la première
// entrée du journal (`nom-de-la-version.test.js`).
export const CURRENT_RELEASE_NAME = {
  fr: 'Le bouton qui compte reste sous ton pouce',
  en: 'The button that matters stays under your thumb',
}
