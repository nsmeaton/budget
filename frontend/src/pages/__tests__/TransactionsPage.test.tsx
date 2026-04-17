import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import TransactionsPage from '../TransactionsPage'
import { renderWithProviders } from '@/test/test-utils'

describe('TransactionsPage', () => {
  it('shows the page heading', async () => {
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText('Transactions')).toBeInTheDocument()
    })
  })

  it('shows loading state initially', () => {
    renderWithProviders(<TransactionsPage />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders transaction list from API', async () => {
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText('Tesco Groceries')).toBeInTheDocument()
    })

    expect(screen.getByText('Salary')).toBeInTheDocument()
    expect(screen.getByText('Netflix')).toBeInTheDocument()
  })

  it('shows total transaction count', async () => {
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText('3 transactions')).toBeInTheDocument()
    })
  })

  it('renders search input', async () => {
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search transactions...')).toBeInTheDocument()
    })
  })

  it('renders table column headers', async () => {
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText('Description')).toBeInTheDocument()
    })

    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Tier')).toBeInTheDocument()
    expect(screen.getByText('Amount')).toBeInTheDocument()
  })

  it('shows category names for transactions', async () => {
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument()
    })

    expect(screen.getByText('Entertainment')).toBeInTheDocument()
  })

  it('displays tier badges', async () => {
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText('Essential')).toBeInTheDocument()
    })

    expect(screen.getByText('Discretionary')).toBeInTheDocument()
  })

  it('shows pagination info', async () => {
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument()
    })
  })

  it('shows account name in transaction rows', async () => {
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      // All transactions are from 'Current Account'
      const accountCells = screen.getAllByText('Current Account')
      expect(accountCells.length).toBeGreaterThan(0)
    })
  })
})
