import React from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { DateRangeProvider } from '@/contexts/DateRangeContext'
import { PrivacyProvider } from '@/contexts/PrivacyContext'

interface WrapperOptions {
  route?: string
  withAuth?: boolean
  withDateRange?: boolean
}

function createWrapper({ route = '/', withAuth = false, withDateRange = false }: WrapperOptions = {}) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    let content = <>{children}</>

    if (withDateRange) {
      content = <DateRangeProvider>{content}</DateRangeProvider>
    }

    content = <PrivacyProvider>{content}</PrivacyProvider>

    if (withAuth) {
      content = <AuthProvider>{content}</AuthProvider>
    }

    return <MemoryRouter initialEntries={[route]}>{content}</MemoryRouter>
  }
}

export function renderWithRouter(
  ui: React.ReactElement,
  options?: WrapperOptions & Omit<RenderOptions, 'wrapper'>
) {
  const { route, withAuth, withDateRange, ...renderOptions } = options || {}
  return render(ui, {
    wrapper: createWrapper({ route, withAuth, withDateRange }),
    ...renderOptions,
  })
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: WrapperOptions & Omit<RenderOptions, 'wrapper'>
) {
  return renderWithRouter(ui, { withAuth: true, withDateRange: true, ...options })
}
