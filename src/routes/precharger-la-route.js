import { matchPath } from 'react-router-dom'

// Au-delà, on rend quand même : le squelette fera son travail.
const DELAI_MAX_MS = 3000

// Charge la page de la route courante AVANT le premier rendu (audit du
// 2026-10-04, PERF-05). Sur une page pré-rendue, React remplace alors le HTML
// servi par la page directement, sans squelette entre les deux, et le fichier
// de la page part dès le démarrage au lieu d'attendre le premier rendu.
//
// Ne bloque jamais : une route sans préchargement (l'accueil, les pages sous
// garde) rend tout de suite, un préchargement en échec aussi, et un fichier
// trop lent ne retient le rendu que DELAI_MAX_MS.
export function prechargerLaRoute(pathname, routes, base = '/') {
  const chemin = base !== '/' && pathname.startsWith(base) ? `/${pathname.slice(base.length)}` : pathname
  const route = routes.find((r) => r.path && r.path !== '*' && matchPath({ path: r.path, end: true }, chemin))
  const precharger = route?.Component?.precharger
  if (!precharger) return Promise.resolve()
  return Promise.race([
    Promise.resolve().then(precharger).catch(() => {}),
    new Promise((resolve) => { setTimeout(resolve, DELAI_MAX_MS) }),
  ]).then(() => undefined)
}
