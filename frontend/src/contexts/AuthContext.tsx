import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/client'

interface AuthState {
  token: string | null
  username: string | null
  loading: boolean
  setupRequired: boolean | null
  login: (username: string, password: string) => Promise<void>
  setup: (username: string, password: string) => Promise<void>
  logout: () => void
  checkStatus: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('budget_token'))
  const [username, setUsername] = useState<string | null>(localStorage.getItem('budget_username'))
  const [loading, setLoading] = useState(true)
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null)

  const checkStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/status')
      setSetupRequired(!data.setup_complete)
    } catch {
      setSetupRequired(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  const login = async (uname: string, pw: string) => {
    const { data } = await api.post('/auth/login', { username: uname, password: pw })
    localStorage.setItem('budget_token', data.token)
    localStorage.setItem('budget_username', data.username)
    setToken(data.token)
    setUsername(data.username)
  }

  const setup = async (uname: string, pw: string) => {
    const { data } = await api.post('/auth/setup', { username: uname, password: pw })
    localStorage.setItem('budget_token', data.token)
    localStorage.setItem('budget_username', data.username)
    setToken(data.token)
    setUsername(data.username)
    setSetupRequired(false)
  }

  const logout = () => {
    localStorage.removeItem('budget_token')
    localStorage.removeItem('budget_username')
    setToken(null)
    setUsername(null)
  }

  return (
    <AuthContext.Provider value={{ token, username, loading, setupRequired, login, setup, logout, checkStatus }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
