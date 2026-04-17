import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import Sidebar from '../Sidebar'
import { renderWithProviders } from '@/test/test-utils'

describe('Sidebar', () => {
  it('renders the app title', async () => {
    renderWithProviders(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByText('💰 Budget')).toBeInTheDocument()
    })
  })

  it('renders all navigation section labels', async () => {
    renderWithProviders(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByText('OVERVIEW')).toBeInTheDocument()
    })

    expect(screen.getByText('TRANSACTIONS')).toBeInTheDocument()
    expect(screen.getByText('MANAGE')).toBeInTheDocument()
  })

  it('renders Dashboard link', async () => {
    renderWithProviders(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })
  })

  it('renders Trends link', async () => {
    renderWithProviders(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByText('Trends')).toBeInTheDocument()
    })
  })

  it('renders Transactions link', async () => {
    renderWithProviders(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByText('Transactions')).toBeInTheDocument()
    })
  })

  it('renders Import link', async () => {
    renderWithProviders(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByText('Import')).toBeInTheDocument()
    })
  })

  it('renders Categories link', async () => {
    renderWithProviders(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByText('Categories')).toBeInTheDocument()
    })
  })

  it('renders Rules link', async () => {
    renderWithProviders(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByText('Rules')).toBeInTheDocument()
    })
  })

  it('renders Accounts link', async () => {
    renderWithProviders(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByText('Accounts')).toBeInTheDocument()
    })
  })

  it('renders all nav links as anchors with correct hrefs', async () => {
    renderWithProviders(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    const links = screen.getAllByRole('link')
    const hrefs = links.map(l => l.getAttribute('href'))

    expect(hrefs).toContain('/')
    expect(hrefs).toContain('/trends')
    expect(hrefs).toContain('/transactions')
    expect(hrefs).toContain('/import')
    expect(hrefs).toContain('/categories')
    expect(hrefs).toContain('/rules')
    expect(hrefs).toContain('/accounts')
  })

  it('renders a logout button', async () => {
    renderWithProviders(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByTitle('Logout')).toBeInTheDocument()
    })
  })
})
