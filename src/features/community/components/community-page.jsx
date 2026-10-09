import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/contexts/auth-provider'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { useBaseRecipes } from '@shared/contexts/data-provider'
import { useConfirm } from '@shared/ui/confirm-dialog/confirm-provider'
import { useSaveErrorToast } from '@shared/hooks/use-save-error-toast'
import {
  listPosts, deletePost,
  listMyPostReactions, reactToPost, removePostReaction,
  getMyMuteStatus,
  getCommunityTermsAcceptedAt, acceptCommunityTerms,
  listMyBlockedUserIds,
  listAttachableRecipes,
  getRecipeNamesByIds,
} from '@shared/api/community'
import { COMMUNITY_I18N } from '@shared/lib/i18n/community-i18n'
import ReportModal from './report-modal'
import CommunityTermsModal from './community-terms-modal'
import CommunityProfileModal from './community-profile-modal'
import { getC } from './community-theme'
import { ComposeModal } from './community-compose-modal'
import { FeedContent } from './community-feed-content'
import { DetailView } from './community-detail-view'
import { CPHeader } from './community-header'
import { useDialogue } from '@shared/hooks/use-dialogue'


// ── CSS partagé (animations + utilitaires, sans couleurs hardcodées) ──────────
const CP_CSS = `
@keyframes cp-page-in {
  from { opacity:0; transform:translateX(3%) scale(.99) }
  to   { opacity:1; transform:translateX(0) scale(1) }
}
@keyframes cp-fade-up {
  from { opacity:0; transform:translateY(14px) }
  to   { opacity:1; transform:translateY(0) }
}
@keyframes cp-shimmer {
  0%   { background-position:-200% center }
  100% { background-position:200% center }
}
.cp-card { transition:transform .18s ease,box-shadow .18s ease }
.cp-card:hover {
  transform:translateY(-2px);
  box-shadow:0 0 24px var(--cat-glow,rgba(200,100,0,.15)),0 6px 20px rgba(0,0,0,.18)
}
.cp-pills,.cp-trending { scrollbar-width:none }
.cp-pills::-webkit-scrollbar,.cp-trending::-webkit-scrollbar { display:none }
.cp-feed { scrollbar-width:thin; scrollbar-color:#C8400044 transparent }
.cp-feed::-webkit-scrollbar { width:3px }
.cp-feed::-webkit-scrollbar-track { background:transparent }
.cp-feed::-webkit-scrollbar-thumb { background:#C8400055; border-radius:2px }
.cp-input:focus,.cp-textarea:focus {
  border-color:#C84000!important;
  box-shadow:0 0 0 2px rgba(200,64,0,.15)!important;
  outline:none
}
`

const TERMS_SEEN_KEY = 'fridge-community-terms-seen'
// v3.409 — flag dismiss permanent de la charte. Set par le bouton « Ne
// plus afficher ». Bloque l'auto-show même si l'user n'a pas signé.
// Reset depuis Profil > Préférences (toggle « Re-afficher la charte »).
// localStorage (per-device) = pas de cross-device sync mais cohérent
// avec une préférence UX (RGPD : less data collected).
const CHARTER_DISMISSED_KEY = 'fridge-community-charter-dismissed'

// ════════════════════════════════════════════════════════════════════════════
// CommunityPage
// ════════════════════════════════════════════════════════════════════════════
export default function CommunityPage({ onClose, lang = 'fr', darkMode = false, onToggleDarkMode, onShowRecipe }) {
  // eslint-disable-next-line no-unused-vars -- profile retourné par useAuth mais pas utilisé ici
  const { user, profile } = useAuth()
  const t = COMMUNITY_I18N[lang] ?? COMMUNITY_I18N.fr
  const confirm = useConfirm()
  const signalerEchec = useSaveErrorToast()
  const windowWidth = useWindowWidth()
  const isMobile = windowWidth < 768
  const C = getC(darkMode)
  const { recipes: baseRecipes, recipeNames } = useBaseRecipes()

  useEffect(() => {
    if (document.getElementById('cp-styles')) return
    const el = document.createElement('style')
    el.id = 'cp-styles'
    el.textContent = CP_CSS
    document.head.appendChild(el)
    return () => { document.getElementById('cp-styles')?.remove() }
  }, [])

  const [view, setView] = useState('feed')
  const [activePostId, setActivePostId] = useState(null)
  const [posts, setPosts] = useState(null)
  // Sprint 11 hotfix — names map pour les recettes custom attachées aux
  // posts. baseRecipes.recipeNames couvre les recettes officielles ;
  // pour les UUIDs custom on doit fetcher leur nom après listPosts.
  const [customRecipeNames, setCustomRecipeNames] = useState(new Map())
  // Map merged : { id → name (objet multi-langue) }. Passé à
  // RecipePreviewCard à la place de recipeNames seul pour que les
  // UUIDs custom résolvent leur nom au lieu de retourner null.
  const mergedRecipeNames = useMemo(() => {
    const merged = { ...recipeNames }
    for (const [id, name] of customRecipeNames) merged[id] = name
    return merged
  }, [recipeNames, customRecipeNames])
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('recent')
  const [reactionsMap, setReactionsMap] = useState(new Map())
  const [composeOpen, setComposeOpen] = useState(false)
  // Sprint 11 hotfix — fetch attachableRecipes la première fois que le
  // compose s'ouvre (lazy, évite fetch initial inutile).
  useEffect(() => {
    if (!composeOpen) return
    let cancelled = false
    // listAttachableRecipes ne dépend plus du user : retourne juste
    // toutes les recettes approved+public de la communauté.
    listAttachableRecipes().then(list => {
      if (!cancelled) setAttachableRecipes(list)
    })
    return () => { cancelled = true }
  }, [composeOpen])
  const [editingPost, setEditingPost] = useState(null)
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [reportTarget, setReportTarget] = useState(null)
  // ReportModal est partagé avec community-profile-modal.jsx, qui gère son
  // propre bouton retour (une seule entrée, callback qui bascule) — ici,
  // usage autonome, donc câblé au niveau de l'appelant.
  useCloseOnBackButton(Boolean(reportTarget), () => setReportTarget(null))
  const [viewingProfileId, setViewingProfileId] = useState(null)
  const [blockedUserIds, setBlockedUserIds] = useState(() => new Set())
  const [muteStatus, setMuteStatus] = useState({ muted: false, until: null })
  const [termsAcceptedAt, setTermsAcceptedAt] = useState(null)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [termsSubmitting, setTermsSubmitting] = useState(false)
  // v3.409 — readOnly track : si l'user clique le 📜 du header alors
  // qu'il a déjà signé, on ouvre la modale en lecture seule (pas de
  // boutons Accepter/Décliner/Ne plus afficher, juste Fermer).
  const [charterReadOnly, setCharterReadOnly] = useState(false)
  // Sprint 11 hotfix — recettes attachables au post (custom user +
  // public communauté). Fetch lazy quand le compose s'ouvre la première
  // fois pour éviter un fetch initial inutile pour les visiteurs qui
  // se contentent de lire le feed.
  const [attachableRecipes, setAttachableRecipes] = useState([])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!user?.id) { setMuteStatus({ muted: false, until: null }); return }
    let cancelled = false
    getMyMuteStatus(user.id).then(s => { if (!cancelled) setMuteStatus(s) })
    return () => { cancelled = true }
  }, [user?.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!user?.id) { setTermsAcceptedAt(null); setShowTermsModal(false); return }
    let cancelled = false
    getCommunityTermsAcceptedAt(user.id).then(at => {
      if (cancelled) return
      setTermsAcceptedAt(at)
      // v3.409 — auto-show seulement si pas signée ET pas dismiss permanent.
      // Si dismissed, l'user a explicitement choisi « Ne plus afficher » →
      // on respecte, pas de spam. Il peut re-déclencher depuis Profil.
      if (!at && localStorage.getItem(CHARTER_DISMISSED_KEY) !== '1') {
        setShowTermsModal(true)
      }
    })
    return () => { cancelled = true }
  }, [user?.id])

  const termsAccepted = !!termsAcceptedAt
  const canInteract = !!user?.id && termsAccepted && !muteStatus.muted
  // Fil vide : l'action qui débloque la suite (invité → connexion ; membre →
  // premier post). Sur mobile, l'en-tête n'a pas la place de la dire.
  const navigate = useNavigate()
  const emptyAction = !user?.id
    ? { label: t.loginToPost, onClick: () => navigate('/login') }
    : canInteract ? { label: t.firstPostBtn, onClick: () => setComposeOpen(true) } : null

  const handleAcceptTerms = async () => {
    if (!user?.id) return
    setTermsSubmitting(true)
    const result = await acceptCommunityTerms(user.id)
    setTermsSubmitting(false)
    if (result.error) throw new Error(result.error)
    setTermsAcceptedAt(result.acceptedAt)
    setShowTermsModal(false)
    localStorage.setItem(TERMS_SEEN_KEY, '1')
  }

  const handleDeclineTerms = () => {
    setShowTermsModal(false)
  }

  // v3.409 — « Ne plus afficher » : ferme la modale + set le flag
  // localStorage qui bloque l'auto-show futur. L'user peut toujours
  // accéder à la charte via le footer du site ou re-activer le popup
  // depuis Profil > Préférences (toggle qui clear le flag).
  const handleNeverShowTerms = () => {
    try { localStorage.setItem(CHARTER_DISMISSED_KEY, '1') } catch { /* silent */ }
    setShowTermsModal(false)
  }

  const loadFeed = useCallback(async () => {
    setPosts(null)
    const list = await listPosts({ category, sort, limit: 30 })
    setPosts(list)
    // Sprint 11 hotfix — fetch names des recettes custom attachées
    // (UUIDs absents de recipeNames). On filtre : si l'id est dans
    // recipeNames (= base recipe), pas besoin de fetcher.
    const customIds = (list ?? [])
      .map(p => p.recipe_id)
      .filter(id => id && !recipeNames?.[id])
    if (customIds.length) {
      const names = await getRecipeNamesByIds(customIds)
      setCustomRecipeNames(prev => {
        const merged = new Map(prev)
        for (const [id, name] of names) merged.set(id, name)
        return merged
      })
    }
    // `recipeNames` est volontairement hors dependances. L'inclure recreerait
    // `loadFeed`, que l'effet juste en dessous appelle a chaque changement
    // d'identite : le fil se rechargerait EN BOUCLE. Il ne sert ici qu'a eviter
    // de redemander des noms deja connus — au pire une requete de trop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sort])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadFeed() }, [loadFeed])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!user?.id) { setReactionsMap(new Map()); return }
    let cancelled = false
    listMyPostReactions(user.id).then(map => { if (!cancelled) setReactionsMap(map) })
    return () => { cancelled = true }
  }, [user?.id])

  // Charge la liste des utilisateurs bloqués pour filtrer le feed.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!user?.id) { setBlockedUserIds(new Set()); return }
    let cancelled = false
    listMyBlockedUserIds(user.id).then(set => { if (!cancelled) setBlockedUserIds(set) })
    return () => { cancelled = true }
  }, [user?.id])

  const handleBlockChange = useCallback((targetUserId, isNowBlocked) => {
    setBlockedUserIds(prev => {
      const next = new Set(prev)
      if (isNowBlocked) next.add(targetUserId); else next.delete(targetUserId)
      return next
    })
  }, [])

  const filteredPosts = useMemo(() => {
    if (!posts) return posts
    let list = posts
    // Masque les posts des utilisateurs bloqués.
    if (blockedUserIds.size > 0) {
      list = list.filter(p => !blockedUserIds.has(p.user_id))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.body?.toLowerCase().includes(q) ||
        p.profile?.username?.toLowerCase().includes(q)
      )
    }
    return list
  }, [posts, search, blockedUserIds])

  // Trending toujours visible quand il y a ≥3 posts.
  // Tri likes desc, puis date desc en départage. Pas de filtre likes>0
  // pour qu'une nouvelle communauté ait toujours sa section "à la une".
  const trending = useMemo(() =>
    posts && posts.length >= 3
      ? [...posts]
          .sort((a, b) => (b.likes_count - a.likes_count) || (new Date(b.created_at) - new Date(a.created_at)))
          .slice(0, 3)
      : [],
    [posts]
  )

  // La réaction s'affiche tout de suite, puis s'annule si l'écriture est
  // refusée (règle d'accès, hors ligne) : l'écran ne montre plus une réaction
  // qui n'existe pas (audit du 2026-10-04, ARCH-05). Rend `true` si elle a
  // été gardée — le détail d'un post annule alors son propre compteur.
  const handleReact = async (postId, emoji) => {
    if (!user?.id || !termsAccepted) return false
    const current = reactionsMap.get(postId) ?? null
    // Re-cliquer la même réaction la retire ; une autre la remplace (compteur inchangé).
    const suivante = current === emoji ? null : emoji
    const delta = suivante === null ? -1 : current ? 0 : 1
    const poser = (reaction, d) => {
      setReactionsMap(prev => { const next = new Map(prev); if (reaction) next.set(postId, reaction); else next.delete(postId); return next })
      if (d) setPosts(prev => prev?.map(p => p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count + d) } : p))
    }
    poser(suivante, delta)
    const { error } = (suivante ? await reactToPost(user.id, postId, emoji) : await removePostReaction(user.id, postId)) ?? {}
    if (!error) return true
    poser(current, -delta)
    signalerEchec('reaction')
    return false
  }

  const handleDelete = async (postId) => {
    if (!(await confirm({ title: t.deleteConfirmTitle, body: t.deleteConfirmBody, danger: true }))) return
    // L'erreur etait jetee ET le post retire de la liste quand meme : un echec
    // le faisait disparaitre de l'ecran alors qu'il restait PUBLIE. On ne
    // retire donc que si la suppression a bien eu lieu ; sinon le post reste
    // visible, ce qui est la verite, et l'utilisateur peut reessayer.
    const { error } = await deletePost(postId) ?? {}
    if (error) { signalerEchec('removal'); return }
    setPosts(prev => prev?.filter(p => p.id !== postId))
    if (view === 'detail' && activePostId === postId) { setView('feed'); setActivePostId(null) }
  }

  const isOwn = (post) => user?.id && post.user_id === user.id
  const openPost = (id) => { setActivePostId(id); setView('detail') }
  const goFeed   = () => { setView('feed'); setActivePostId(null) }
  // Plein écran par-dessus l'application : rôle, nom, focus piégé (A11Y-14).
  // Échap = le bouton retour (discussion → fil, fil → fermer).
  const dialogue = useDialogue({ onClose: view === 'detail' ? goFeed : onClose, nom: t.title })

  return (
    <div {...dialogue.proprietes} style={{
      position: 'fixed', inset: 0, zIndex: 120,
      background: C.page,
      display: 'flex', flexDirection: 'column',
      animation: 'cp-page-in .32s cubic-bezier(.25,.46,.45,.94) both',
      fontFamily: 'inherit',
    }}>
      <CPHeader
        view={view}
        onBack={view === 'detail' ? goFeed : onClose}
        onCompose={() => setComposeOpen(true)}
        showSearch={showSearch}
        setShowSearch={setShowSearch}
        search={search}
        setSearch={setSearch}
        canInteract={canInteract}
        muteStatus={muteStatus}
        user={user}
        t={t}
        isMobile={isMobile}
        darkMode={darkMode}
        onToggleDarkMode={onToggleDarkMode}
        onShowCharter={user?.id ? () => {
          // v3.409 — relecture de la charte. Si déjà signée, mode readOnly
          // (juste Fermer). Sinon, modale normale (Accepter/Décliner/Ne
          // plus afficher).
          setCharterReadOnly(!!termsAcceptedAt)
          setShowTermsModal(true)
        } : null}
      />

      {muteStatus.muted && (
        <div style={{ flexShrink: 0, padding: '8px 16px', background: C.dangerDim, borderBottom: `1px solid ${C.danger}40`, color: C.danger, fontSize: '14px', fontWeight: 600 }}>
          ⚠️ {t.mutedBanner}{' '}
          {muteStatus.until && new Date(muteStatus.until).getFullYear() < 9999 && (
            <span style={{ fontWeight: 500 }}>
              {t.mutedUntil(new Date(muteStatus.until).toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang))}
            </span>
          )}
        </div>
      )}

      {/* v3.409 — bannière « charte refusée » retirée : redondante avec
          l'auto-show modal (qui réapparaît à chaque visite tant que la
          charte n'est pas signée). Si l'user a cliqué « Ne plus afficher »,
          il a explicitement choisi de ne pas être sollicité, on respecte. */}

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {view === 'feed' ? (
          <FeedContent
            posts={filteredPosts}
            trending={trending}
            reactionsMap={reactionsMap}
            category={category}
            setCategory={setCategory}
            sort={sort}
            setSort={setSort}
            search={search}
            onOpenPost={openPost}
            onReact={handleReact}
            onEdit={(post) => { setEditingPost(post); setComposeOpen(true) }}
            onDelete={handleDelete}
            onReport={(type, id) => setReportTarget({ type, id })}
            isOwn={isOwn}
            canInteract={canInteract}
            muteStatus={muteStatus}
            t={t}
            lang={lang}
            isMobile={isMobile}
            user={user}
            darkMode={darkMode}
            recipeNames={mergedRecipeNames}
            onShowRecipe={onShowRecipe}
            onShowProfile={setViewingProfileId}
            emptyAction={emptyAction}
          />
        ) : activePostId && (
          <DetailView
            postId={activePostId}
            user={user}
            t={t}
            lang={lang}
            isMobile={isMobile}
            reactionsMap={reactionsMap}
            onReact={handleReact}
            onDelete={handleDelete}
            onEdit={(post) => { setEditingPost(post); setComposeOpen(true) }}
            onReport={(type, id) => setReportTarget({ type, id })}
            muteStatus={muteStatus}
            canInteract={canInteract}
            isOwn={isOwn}
            darkMode={darkMode}
            recipeNames={mergedRecipeNames}
            onShowRecipe={onShowRecipe}
            onShowProfile={setViewingProfileId}
            blockedUserIds={blockedUserIds}
          />
        )}
      </div>

      {reportTarget && user?.id && (
        <ReportModal
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          userId={user.id}
          lang={lang}
          darkMode={darkMode}
          zIndex={130}
          onClose={() => setReportTarget(null)}
        />
      )}

      {showTermsModal && user?.id && (
        <CommunityTermsModal
          lang={lang}
          darkMode={darkMode}
          submitting={termsSubmitting}
          readOnly={charterReadOnly}
          onAccept={handleAcceptTerms}
          onDecline={handleDeclineTerms}
          onNeverShow={handleNeverShowTerms}
          onClose={() => { setShowTermsModal(false); setCharterReadOnly(false) }}
        />
      )}

      {viewingProfileId && (
        <CommunityProfileModal
          userId={viewingProfileId}
          currentUserId={user?.id ?? null}
          lang={lang}
          darkMode={darkMode}
          onShowRecipe={onShowRecipe ? (recipe) => { setViewingProfileId(null); onShowRecipe(recipe) } : undefined}
          onBlockChange={handleBlockChange}
          onClose={() => setViewingProfileId(null)}
        />
      )}

      {composeOpen && (
        <ComposeModal
          initialPost={editingPost}
          initialCategory={category !== 'all' ? category : null}
          user={user}
          t={t}
          lang={lang}
          darkMode={darkMode}
          baseRecipes={baseRecipes}
          recipeNames={recipeNames}
          // Sprint 11 hotfix — recettes attachables : base + custom + public.
          attachableRecipes={attachableRecipes}
          onClose={() => { setComposeOpen(false); setEditingPost(null) }}
          onSaved={(savedPost) => {
            setComposeOpen(false); setEditingPost(null)
            if (editingPost) {
              setPosts(prev => prev?.map(p => p.id === savedPost.id ? savedPost : p))
            } else {
              loadFeed()
            }
          }}
        />
      )}
    </div>
  )
}

