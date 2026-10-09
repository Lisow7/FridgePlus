// Modale "Mes listes" — Phase L.3 (read-only)
// Phase L.4 : actions par liste (charger / renommer / supprimer)
//
// Actions :
//   - Charger : remplace le panier actuel par les items de la liste. Si le
//     panier contient déjà des items, on demande confirmation avant écrasement.
//   - Renommer : input inline (édition à la volée). Le focus va sur l'input,
//     Enter sauvegarde, Escape annule.
//   - Supprimer : suppression optimiste (UI cache l'item) + appel BDD réel
//     après 10s — le user peut annuler dans cette fenêtre via UndoContext.
//
// A11y : focus trap, aria-modal, ESC ferme, aria-live pour annonces.

import { useEffect, useRef, useState } from 'react'
import {
  LuX, LuList, LuListChecks, LuPackage,
  LuFolderOpen, LuPencil, LuTrash2, LuCheck,
} from 'react-icons/lu'
import Button from '@shared/ui/button'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { useUndo } from '@shared/contexts/undo-provider'
import { useConfirm } from '@shared/ui/confirm-dialog/confirm-provider'
import {
  loadShoppingLists,
  updateShoppingList,
  deleteShoppingList,
  createShoppingList,
  SHOPPING_LISTS_MAX_PER_USER,
  SHOPPING_LIST_NAME_MAX,
} from '@features/cart/api/shopping-lists'

const I18N = {
  fr: {
    title: 'Mes listes',
    counter: '{{n}} / {{max}} listes',
    empty: 'Tu n\'as pas encore sauvegardé de liste.',
    emptyHint: 'Quand tu auras des éléments dans ton panier, clique sur « Sauvegarder ma liste ».',
    close: 'Fermer',
    loading: 'Chargement…',
    items: '{{n}} élément(s)',
    updated: 'Modifiée le {{date}}',
    actionLoad: 'Charger',
    actionRename: 'Renommer',
    actionDelete: 'Supprimer',
    confirmReplace: 'Ton panier actuel n\'est pas vide. Le remplacer par cette liste ?',
    nameValid: 'OK',
    nameCancel: 'Annuler',
    nameTooLong: '80 caractères max.',
    nameRequired: 'Nom requis.',
    listLoaded: 'Liste chargée dans le panier.',
    listRenamed: 'Liste renommée.',
    listDeleted: 'Liste supprimée',  // pour le toast undo
    deleteFailed: 'Erreur lors de la suppression. Réessaie.',
    confirmDelete: 'Supprimer définitivement la liste « {{name}} » ?\n\nCette action est différente de « Fermer ma liste » dans le panier — ici tu supprimes la liste sauvegardée. Tu auras 10 secondes pour annuler.',
    ctaStartList: 'Démarrer une nouvelle liste',
  },
  en: {
    title: 'My lists',
    counter: '{{n}} / {{max}} lists',
    empty: 'You haven\'t saved any list yet.',
    emptyHint: 'When you have items in your basket, click « Save my list ».',
    close: 'Close',
    loading: 'Loading…',
    items: '{{n}} item(s)',
    updated: 'Updated {{date}}',
    actionLoad: 'Load',
    actionRename: 'Rename',
    actionDelete: 'Delete',
    confirmReplace: 'Your current basket isn\'t empty. Replace it with this list?',
    nameValid: 'OK',
    nameCancel: 'Cancel',
    nameTooLong: '80 chars max.',
    nameRequired: 'Name required.',
    listLoaded: 'List loaded into basket.',
    listRenamed: 'List renamed.',
    listDeleted: 'List deleted',
    deleteFailed: 'Error while deleting. Please retry.',
    confirmDelete: 'Permanently delete the list « {{name}} » ?\n\nThis is different from « Close my list » in the cart — here you\'re deleting the saved list. You will have 10 seconds to undo.',
    ctaStartList: 'Start a new list',
  },
}

function formatDate(iso, lang) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang, {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

/**
 * @param {object} props
 * @param {string} props.userId
 * @param {Function} props.onClose
 * @param {string} [props.lang='fr']
 * @param {boolean} [props.darkMode=false]
 * @param {number} [props.refreshKey=0]
 * @param {boolean} [props.basketHasItems=false] - pour confirm avant écrasement
 * @param {Function} [props.onLoadList] - async (items) => { error: object|null }
 * @param {Function} [props.onListsChanged] - notifie le parent qu'une mutation a eu
 *   lieu (delete/rename) pour qu'il refresh les composants dépendants (ex :
 *   EmptyBasketState qui affiche les listes récentes en arrière-plan).
 */
export default function ShoppingListsModal({
  userId, onClose, lang = 'fr', darkMode = false, refreshKey = 0,
  basketHasItems = false, onLoadList, onListsChanged,
}) {
  const t = I18N[lang] ?? I18N.fr
  const containerRef = useRef(null)
  useFocusTrap(containerRef, { active: true, onEscape: onClose })
  useCloseOnBackButton(true, onClose)
  const { trigger } = useUndo()
  const confirm = useConfirm()

  const [lists, setLists] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState(null)
  const [busyId, setBusyId] = useState(null) // pour spinner sur l'action en cours
  const [srMessage, setSrMessage] = useState('')

  // Le toggle '' -> msg force le re-render même si le message est identique,
  // sinon aria-live ne réannonce pas. Le timer doit être nettoyé au démontage :
  // sinon il se déclenche après le teardown de jsdom et fait sortir Vitest en
  // erreur (`window is not defined`) alors que tous les tests passent.
  const srTimerRef = useRef(null)
  useEffect(() => () => clearTimeout(srTimerRef.current), [])

  function announceSr(msg) {
    setSrMessage('')
    clearTimeout(srTimerRef.current)
    srTimerRef.current = setTimeout(() => setSrMessage(msg), 50)
  }

  useEffect(() => {
    if (!userId) return
    let alive = true
    loadShoppingLists(userId).then(data => {
      if (alive) setLists(data)
    })
    return () => { alive = false }
  }, [userId, refreshKey])

  // `lists` est désormais source de vérité directe (delete BDD
  // immédiat + recreate à l'undo, plus besoin de masquage par hiddenIds).
  const visibleLists = lists ?? []

  async function handleLoadList(list) {
    if (!onLoadList) return
    if (basketHasItems && !(await confirm({ title: t.confirmReplace, danger: true }))) return
    setBusyId(list.id)
    try {
      const r = await onLoadList(list.items ?? [], { id: list.id, name: list.name })
      if (!r?.error) announceSr(t.listLoaded)
    } finally {
      setBusyId(null)
    }
  }

  function startRename(list) {
    setRenamingId(list.id)
    setRenameValue(list.name)
    setRenameError(null)
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
    setRenameError(null)
  }

  async function commitRename(listId) {
    const trimmed = renameValue.trim()
    if (trimmed.length === 0) {
      setRenameError(t.nameRequired)
      return
    }
    if (trimmed.length > SHOPPING_LIST_NAME_MAX) {
      setRenameError(t.nameTooLong)
      return
    }
    setBusyId(listId)
    let error
    try {
      ;({ error } = await updateShoppingList(listId, { name: trimmed }))
    } finally {
      setBusyId(null)
    }
    if (error) {
      setRenameError(error.message)
      return
    }
    setLists(prev => (prev ?? []).map(l => l.id === listId ? { ...l, name: trimmed } : l))
    cancelRename()
    announceSr(t.listRenamed)
    // Notifie le parent pour qu'il bump son refreshKey (ex :
    // EmptyBasketState affichant en arrière-plan les listes récentes).
    onListsChanged?.()
  }

  async function handleDelete(list) {
    // Confirmation explicite avant suppression définitive d'une
    // liste. L'utilisateur a parfois confondu "supprimer la liste" avec
    // "fermer le panier actuel" — la confirmation clarifie la portée.
    // Le texte source sépare déjà titre et détails via "\n\n" (cf.
    // t.confirmDelete) — on route ce découpage existant vers title/body
    // au lieu de l'aplatir dans un seul champ.
    const [confirmTitle, ...confirmBodyParts] = t.confirmDelete.replace('{{name}}', list.name).split('\n\n')
    const confirmBody = confirmBodyParts.join('\n\n') || undefined
    if (!(await confirm({ title: confirmTitle, body: confirmBody, danger: true }))) return

    // Stratégie « delete immédiat + recreate à l'undo ».
    //
    // Avant : on cachait la ligne dans la modale (optimistic) et le DELETE
    // BDD réel n'avait lieu qu'après les 10s d'undo. Conséquence : le panel
    // panier en arrière-plan (EmptyBasketState) continuait d'afficher la
    // liste pendant ces 10s, car loadShoppingLists relisait la BDD et
    // retrouvait la ligne intacte. → impression que rien ne se passe.
    //
    // Maintenant : snapshot du contenu, DELETE immédiat, propagation
    // onListsChanged. Si user clique « Annuler » dans les 10s, on recrée la
    // liste avec son contenu via createShoppingList (nouvelle id BDD mais
    // contenu identique).
    const snapshot = { name: list.name, items: list.items ?? [] }

    // Optimistic UI dans la modale (visible immédiatement)
    setLists(prev => (prev ?? []).filter(l => l.id !== list.id))

    setBusyId(list.id)
    let error
    try {
      ;({ error } = await deleteShoppingList(list.id))
    } finally {
      setBusyId(null)
    }
    if (error) {
      // DELETE échoué : restaurer la ligne et signaler
      setLists(prev => [list, ...(prev ?? [])])
      announceSr(t.deleteFailed)
      return
    }

    // Synchronise le panel panier en arrière-plan immédiatement
    onListsChanged?.()

    trigger?.({
      label: `${t.listDeleted} : ${list.name}`,
      onCancel: async () => {
        // Restoration : recrée la liste avec son contenu d'origine
        if (!userId) return
        const { data, error: errCreate } = await createShoppingList(userId, snapshot.name, snapshot.items)
        if (errCreate || !data) {
          announceSr(t.deleteFailed)
          return
        }
        setLists(prev => [data, ...(prev ?? [])])
        onListsChanged?.()
      },
    })
  }

  const bg     = darkMode ? '#131E2C' : '#FFFFFF'
  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? 'rgba(240,232,220,0.6)' : 'rgba(44,26,14,0.55)'
  const border = darkMode ? 'rgba(247,168,94,0.20)' : 'rgba(212,106,16,0.18)'
  const cardBg = darkMode ? '#1A2535' : '#FAF6EE'
  const inputBg = darkMode ? '#0E1420' : '#FFFFFF'

  const count = visibleLists.length

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="my-lists-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      {/* Live region SR */}
      <div role="status" aria-live="polite" aria-atomic="true" style={{
        position: 'absolute', width: '1px', height: '1px',
        padding: 0, margin: '-1px', overflow: 'hidden',
        clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
      }}>
        {srMessage}
      </div>

      <div
        ref={containerRef}
        style={{
          background: bg, color: fg,
          border: `1px solid ${border}`, borderRadius: '12px',
          maxWidth: '600px', width: '100%', maxHeight: '85dvh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: `1px solid ${border}`,
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <span aria-hidden="true" style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'var(--gradient-warm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#2C1A0E', flexShrink: 0,
          }}>
            <LuListChecks size={16} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="my-lists-title" style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
              {t.title}
            </h2>
            {lists !== null && (
              <div style={{ fontSize: '11px', color: muted, marginTop: '2px' }}>
                {t.counter.replace('{{n}}', count).replace('{{max}}', SHOPPING_LISTS_MAX_PER_USER)}
              </div>
            )}
          </div>
          <Button
            variant="secondary"
            size="icon"
            onClick={onClose}
            aria-label={t.close}
            className="h-8 w-8 rounded-lg"
            style={{ borderColor: border, color: muted }}
          >
            <LuX size={16} aria-hidden="true" />
          </Button>
        </div>

        {/* Body */}
        <div style={{ padding: '12px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {lists === null && (
            <div style={{ padding: '32px 12px', textAlign: 'center', color: muted, fontSize: '13px' }}>
              {t.loading}
            </div>
          )}

          {lists !== null && visibleLists.length === 0 && (
            <div style={{
              padding: '24px 16px', textAlign: 'center',
              border: `1px dashed ${border}`, borderRadius: '10px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
            }}>
              <LuList size={28} aria-hidden="true" style={{ color: muted }} />
              <div style={{ fontSize: '14px', fontWeight: 600 }}>{t.empty}</div>
              <div style={{ fontSize: '12px', color: muted, lineHeight: 1.5, maxWidth: '380px' }}>
                {t.emptyHint}
              </div>
            </div>
          )}

          {visibleLists.map(list => {
            const isRenaming = renamingId === list.id
            const isBusy = busyId === list.id
            const itemsCount = Array.isArray(list.items) ? list.items.length : 0
            return (
              <div
                key={list.id}
                style={{
                  padding: '12px 14px',
                  background: cardBg,
                  border: `1px solid ${border}`,
                  borderRadius: '10px',
                  display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                  opacity: isBusy ? 0.6 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                <span aria-hidden="true" style={{ color: 'var(--color-warm-600)', flexShrink: 0 }}>
                  <LuPackage size={18} />
                </span>

                <div style={{ flex: 1, minWidth: '160px' }}>
                  {isRenaming ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <input
                        type="text"
                        value={renameValue}
                        onChange={e => { setRenameValue(e.target.value); setRenameError(null) }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); commitRename(list.id) }
                          if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
                        }}
                        autoFocus
                        maxLength={SHOPPING_LIST_NAME_MAX + 5}
                        aria-label={t.actionRename}
                        aria-invalid={!!renameError}
                        style={{
                          padding: '6px 10px',
                          background: inputBg,
                          border: `1px solid ${renameError ? '#E03131' : border}`,
                          borderRadius: '6px',
                          color: fg, fontSize: '13px', fontFamily: 'inherit',
                          outline: 'none',
                        }}
                      />
                      {renameError && (
                        <span style={{ fontSize: '11px', color: '#E03131' }}>{renameError}</span>
                      )}
                    </div>
                  ) : (
                    <>
                      <div style={{
                        fontSize: '14px', fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {list.name}
                      </div>
                      <div style={{ fontSize: '11px', color: muted, marginTop: '2px' }}>
                        {t.items.replace('{{n}}', itemsCount)}
                        {' · '}
                        {t.updated.replace('{{date}}', formatDate(list.updated_at, lang))}
                      </div>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  {isRenaming ? (
                    <>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => commitRename(list.id)}
                        disabled={isBusy}
                        title={t.nameValid}
                        aria-label={t.nameValid}
                        className="h-8 w-8 rounded-[7px]"
                        style={{ borderColor: border, color: fg }}
                      >
                        <LuCheck size={14} aria-hidden="true" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={cancelRename}
                        disabled={isBusy}
                        title={t.nameCancel}
                        aria-label={t.nameCancel}
                        className="h-8 w-8 rounded-[7px]"
                        style={{ borderColor: border, color: muted }}
                      >
                        <LuX size={14} aria-hidden="true" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => handleLoadList(list)}
                        disabled={isBusy}
                        title={t.actionLoad}
                        aria-label={`${t.actionLoad} ${list.name}`}
                        className="h-8 w-8 rounded-[7px]"
                        style={{ borderColor: border, color: fg }}
                      >
                        <LuFolderOpen size={14} aria-hidden="true" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => startRename(list)}
                        disabled={isBusy}
                        title={t.actionRename}
                        aria-label={`${t.actionRename} ${list.name}`}
                        className="h-8 w-8 rounded-[7px]"
                        style={{ borderColor: border, color: fg }}
                      >
                        <LuPencil size={14} aria-hidden="true" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => handleDelete(list)}
                        disabled={isBusy}
                        title={t.actionDelete}
                        aria-label={`${t.actionDelete} ${list.name}`}
                        className="h-8 w-8 rounded-[7px]"
                        style={{ borderColor: 'rgba(208,96,96,0.30)', color: '#D06060' }}
                      >
                        <LuTrash2 size={14} aria-hidden="true" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

