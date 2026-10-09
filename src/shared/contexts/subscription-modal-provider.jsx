import { createContext, useContext, useState, useCallback } from 'react'

const SubscriptionModalContext = createContext({ openUpgradeModal: () => {} })

export function SubscriptionModalProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const openUpgradeModal  = useCallback(() => setIsOpen(true),  [])
  const closeUpgradeModal = useCallback(() => setIsOpen(false), [])
  return (
    <SubscriptionModalContext.Provider value={{ openUpgradeModal, closeUpgradeModal, isUpgradeOpen: isOpen }}>
      {children}
    </SubscriptionModalContext.Provider>
  )
}

export const useUpgradeModal = () => useContext(SubscriptionModalContext)
