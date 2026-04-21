import React, { createContext, useContext, useState, useEffect } from 'react'

interface PrivacyState {
  hideAmounts: boolean
  toggleHideAmounts: () => void
}

const PrivacyContext = createContext<PrivacyState | undefined>(undefined)

const STORAGE_KEY = 'budget_hide_amounts'

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hideAmounts, setHideAmounts] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(hideAmounts))
    } catch {
      // ignore
    }
  }, [hideAmounts])

  const toggleHideAmounts = () => setHideAmounts(prev => !prev)

  return (
    <PrivacyContext.Provider value={{ hideAmounts, toggleHideAmounts }}>
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext)
  if (!ctx) throw new Error('usePrivacy must be used within PrivacyProvider')
  return ctx
}
