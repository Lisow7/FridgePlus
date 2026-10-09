// ChangelogPage non réexporté ici : seul consommateur = lazy() dans
// routes-config.js — un réexport statique du barrel neutraliserait ce
// code-splitting (Rollup INEFFECTIVE_DYNAMIC_IMPORT). Importer directement
// '@features/changelog/pages/changelog-page' si besoin statique.
export { CURRENT_VERSION } from '@shared/lib/version'
export { CHANGELOG }       from '@features/changelog/data/changelog'
export { useNewRelease } from './hooks/use-new-release'
