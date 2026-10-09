import { useState, useEffect } from 'react'
import leoProfanity from 'leo-profanity'
import { useConfirm } from '@shared/ui/confirm-dialog/confirm-provider'
import { useSaveErrorToast } from '@shared/hooks/use-save-error-toast'
import {
  getPost, listReplies, listMyLikedReplyIds,
  likeReply, unlikeReply, createReply, deleteReply, canReply,
} from '@shared/api/community'

// État de la vue détail d'un post communauté — extrait de community-page.jsx
// (2026-07-26, audit front §2). Chargement (post + réponses + likes), likes de
// réponses, réaction au post, envoi et suppression d'une réponse.
//
// Appelé DANS DetailView (et non dans CommunityPage) : la vue est montée
// conditionnellement (`activePostId && <DetailView/>`), donc l'état doit mourir
// avec elle — remonter le hook ferait survivre le post à un aller-retour
// détail → feed → détail, alors qu'aujourd'hui il est rechargé.
//
// `post`/`replies` sont exposés bruts (pas de booléen `loading`) : la vue
// distingue « chargement » (`post === null && replies === null`) de « post
// supprimé » (`!post` après réponse), ce qu'un seul drapeau écraserait.
//
// La dérivation (filtre des bloqués, racines/enfants, cible de réponse) reste
// dans la vue, comme pour useRecipeCost.
export function usePostDetail({ postId, user, t, canInteract, reactionsMap, onReact }) {
  const confirm = useConfirm()
  const signalerEchec = useSaveErrorToast()
  const [post, setPost] = useState(null)
  const [replies, setReplies] = useState(null)
  const [replyBody, setReplyBody] = useState('')
  const [replyToId, setReplyToId] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [likedReplyIds, setLikedReplyIds] = useState(new Set())

  // Volontairement sans remise à null de post/replies : pendant un changement
  // de postId, l'ancien contenu reste affiché jusqu'à l'arrivée du nouveau.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      getPost(postId),
      listReplies(postId),
      user?.id ? listMyLikedReplyIds(user.id, postId) : Promise.resolve(new Set()),
    ]).then(([p, r, liked]) => {
      if (cancelled) return
      setPost(p); setReplies(r); setLikedReplyIds(liked)
    })
    return () => { cancelled = true }
  }, [postId, user?.id])

  // « J'aime » et réactions : affichés tout de suite, annulés si l'écriture
  // est refusée, et dits (audit du 2026-10-04, ARCH-05).
  const handleToggleReplyLike = async (replyId) => {
    if (!user?.id || !canInteract) return
    const liked = likedReplyIds.has(replyId)
    const poser = (aime) => {
      setLikedReplyIds(prev => { const next = new Set(prev); if (aime) next.add(replyId); else next.delete(replyId); return next })
      setReplies(prev => prev?.map(r => r.id === replyId ? { ...r, likes_count: Math.max(0, (r.likes_count ?? 0) + (aime ? 1 : -1)) } : r))
    }
    poser(!liked)
    const { error } = (liked ? await unlikeReply(user.id, replyId) : await likeReply(user.id, replyId)) ?? {}
    if (!error) return
    poser(liked)
    signalerEchec('reaction')
  }

  const handleReactPost = async (emoji) => {
    if (!canInteract || !post) return
    const current = reactionsMap.get(post.id)
    const delta = current === emoji ? -1 : current ? 0 : 1
    const compter = (d) => setPost(prev => prev ? { ...prev, likes_count: Math.max(0, prev.likes_count + d) } : prev)
    compter(delta)
    // La page annule sa réaction et le dit ; le compteur du détail suit.
    if (await onReact(post.id, emoji) === false) compter(-delta)
  }

  const handleReplySubmit = async () => {
    if (!user?.id || !replyBody.trim()) return
    if (leoProfanity.check(replyBody)) { setSubmitError(t.profanityWarning); return }
    if (!await canReply(user.id)) { setSubmitError(t.spamLimitReply); return }
    setSubmitting(true)
    const { data, error } = await createReply(user.id, postId, replyBody.trim(), replyToId)
    setSubmitting(false)
    if (error) { setSubmitError(error); return }
    setReplyBody(''); setSubmitError(null); setReplyToId(null)
    setReplies(prev => [...(prev ?? []), data])
  }

  const handleDeleteReply = async (replyId) => {
    if (!(await confirm({ title: t.deleteConfirmTitle, danger: true }))) return
    // Retirée de l'écran SEULEMENT si la suppression a eu lieu (même règle
    // que la suppression d'un post).
    const { error } = await deleteReply(replyId) ?? {}
    if (error) { signalerEchec('removal'); return }
    setReplies(prev => prev?.filter(r => r.id !== replyId))
  }

  return {
    post, replies, likedReplyIds,
    replyBody, setReplyBody,
    replyToId, setReplyToId,
    submitError, submitting,
    handleToggleReplyLike, handleReactPost, handleReplySubmit, handleDeleteReply,
  }
}
