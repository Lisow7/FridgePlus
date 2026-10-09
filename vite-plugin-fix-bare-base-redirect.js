// Bug (2026-07-17) : sur le dev server Vite (et `vite preview`), une requête
// dont le chemin est EXACTEMENT le `base` sans son slash final (ex. `/FridgePlus`
// ou `/FridgePlus?recettes=1`) renvoie une vraie 404 serveur, alors que le
// même chemin AVEC le slash final (`/FridgePlus/`) sert l'app normalement.
// Root cause : le middleware interne de Vite (fallback SPA + fichiers
// statiques) attend `base` avec son slash final pour matcher — un chemin
// imbriqué (`/FridgePlus/x`) tombe bien dans le fallback SPA, mais le
// chemin racine nu ne matche ni un fichier ni le préfixe attendu → 404.
// Reproductible : cliquer "Recettes" depuis Actions rapides appelle
// `setSearchParams()` (React Router) sur la route racine, qui pousse
// `/FridgePlus?recettes=1` dans l'historique — un rechargement/partage de
// cette URL 404 alors.
// Vercel (base=`/`) n'est pas concerné : `vercel.json` a un rewrite SPA
// catch-all qui sert `index.html` quel que soit le chemin.
export function createBareBaseRedirectMiddleware(base) {
  const bareBase = base.replace(/\/$/, '')
  if (!bareBase) return null // base === '/' (Vercel) : rien à normaliser

  return function bareBaseRedirect(req, res, next) {
    const qIndex = req.url.indexOf('?')
    const pathname = qIndex === -1 ? req.url : req.url.slice(0, qIndex)
    if (pathname !== bareBase) {
      next()
      return
    }
    const search = qIndex === -1 ? '' : req.url.slice(qIndex)
    res.writeHead(301, { Location: `${base}${search}` })
    res.end()
  }
}

export function fixBareBaseRedirect(base) {
  const middleware = createBareBaseRedirectMiddleware(base)
  if (!middleware) return null

  return {
    name: 'fix-bare-base-redirect',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
