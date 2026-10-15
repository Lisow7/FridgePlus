import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '@shared/contexts/ui-provider'
import { useDarkMode } from '@shared/contexts/ui-provider'
import { ConfirmDeleteModal, ConfirmActionModal } from './confirm-modals'

// Remplace window.confirm()/confirm() natif par une modale stylée
// Fridge+, cohérente entre navigateurs et respectant la charte visuelle.
// Design : la conception « confirm-dialog-migration » du 2026-07-18
//
// Pattern calqué sur ToastProvider (context + state + hook + portal dans
// le même fichier). Ne redessine rien : pilote ConfirmDeleteModal (danger)
// / ConfirmActionModal (neutre), déjà en prod côté admin.

// Seul « Annuler » a un texte par défaut : le bouton qui confirme nomme
// toujours l'action (« Vider la liste », « Supprimer la publication »…),
// décision du 2026-10-08 — un garde-fou (confirmations-nommees) y veille.
const DEFAULT_LABELS = {
  fr: { cancel: 'Annuler' },
  en: { cancel: 'Cancel' },
}

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const { lang } = useLang()
  const { darkMode } = useDarkMode()
  const [request, setRequest] = useState(null)

  const confirm = useCallback((options) => {
    // Sans nom d'action, rien ne s'ouvre et rien ne se fait (le geste est
    // souvent sans retour) : le garde-fou l'empêche d'arriver jusqu'ici.
    if (!options?.confirmLabel) {
      console.error('[confirm] confirmLabel manquant :', options?.title)
      return Promise.resolve(false)
    }
    return new Promise((resolve) => {
      setRequest((prev) => {
        // Superposition : un appel confirm() avant résolution du précédent
        // ne doit jamais laisser son appelant en attente indéfiniment.
        prev?.resolve(false)
        const labels = DEFAULT_LABELS[lang] ?? DEFAULT_LABELS.fr
        return {
          title: options.title,
          body: options.body,
          danger: options.danger ?? false,
          confirmLabel: options.confirmLabel,
          cancelLabel: options.cancelLabel ?? labels.cancel,
          resolve,
        }
      })
    })
  }, [lang])

  const settle = useCallback((value) => {
    setRequest((prev) => {
      prev?.resolve(value)
      return null
    })
  }, [])

  // Sécurité : si le provider est démonté (HMR dev, crash) pendant qu'une
  // requête est en attente, on ne laisse jamais l'appelant bloqué. Ne
  // s'applique en pratique jamais en prod (ConfirmProvider est monté une
  // fois à la racine et ne se démonte jamais pendant la vie de l'app).
  useEffect(() => {
    return () => {
      setRequest((prev) => {
        prev?.resolve(false)
        return prev
      })
    }
  }, [])

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {request && typeof document !== 'undefined' && createPortal(
        request.danger
          ? (
            <ConfirmDeleteModal
              title={request.title}
              body={request.body}
              confirmLabel={request.confirmLabel}
              cancelLabel={request.cancelLabel}
              darkMode={darkMode}
              onConfirm={() => settle(true)}
              onCancel={() => settle(false)}
            />
          )
          : (
            <ConfirmActionModal
              title={request.title}
              body={request.body}
              confirmLabel={request.confirmLabel}
              cancelLabel={request.cancelLabel}
              darkMode={darkMode}
              onConfirm={() => settle(true)}
              onCancel={() => settle(false)}
            />
          ),
        document.body,
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm() doit être utilisé dans un <ConfirmProvider>')
  return ctx
}
