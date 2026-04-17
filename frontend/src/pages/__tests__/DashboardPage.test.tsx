import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import DashboardPage from '../DashboardPage'
import { renderWithProviders } from '@/test/test-utils'

// Mock recharts to avoid canvas/SVG rendering issues in jsdom
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  const createMockComponent = (name: string) => {
    return ({ children, ...props }: any) => (
      <div data-testid={`mock-${name}`} {...props}>{children}</div>
    )
  }
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 500, height: 300 }}>{children}</div>
    ),
    BarChart: createMockComponent('BarChart'),
    Bar: createMockComponent('Bar'),
    XAxis: createMockComponent('XAxis'),
    YAxis: createMockComponent('YAxis'),
    CartesianGrid: createMockComponent('CartesianGrid'),
    Tooltip: createMockComponent('Tooltip'),
    Legend: createMockComponent('Legend'),
  }
})

describe('DashboardPage', () => {
  it('shows loading state initially', () => {
    renderWithProviders(<DashboardPage />)
    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument()
  })

  it('renders the dashboard heading', async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })
  })

  it('renders KPI cards with mock data', async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Total Income')).toBeInTheDocument()
    })

    expect(screen.getByText('Total Spending')).toBeInTheDocument()
    expect(screen.getByText('Avg Monthly Essential')).toBeInTheDocument()
    expect(screen.getByText('Total Savings')).toBeInTheDocument()
  })

  it('displays formatted currency values from API', async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      // Total income of £60,000
      expect(screen.getByText('£60,000.00')).toBeInTheDocument()
    })

    // Total spending of £35,000
    expect(screen.getByText('£35,000.00')).toBeInTheDocument()
    // Avg monthly essential £2,500
    expect(screen.getByText('£2,500.00')).toBeInTheDocument()
    // Total savings £15,000
    expect(screen.getByText('£15,000.00')).toBeInTheDocument()
  })

  it('shows income change percentage', async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('+5.2% vs last period')).toBeInTheDocument()
    })
  })

  it('shows savings rate in subtitle', async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Savings rate: 25.0%')).toBeInTheDocument()
    })
  })

  it('renders chart section titles', async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Income vs Spending')).toBeInTheDocument()
    })

    expect(screen.getByText('Spending by Tier')).toBeInTheDocument()
  })

  it('shows the monthly breakdown table', async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Monthly Breakdown')).toBeInTheDocument()
    })

    // Row labels from the breakdown table
    expect(screen.getByText('INCOME')).toBeInTheDocument()
    expect(screen.getByText('SPENDING')).toBeInTheDocument()
    expect(screen.getByText('SAVINGS')).toBeInTheDocument()
    expect(screen.getByText('NET')).toBeInTheDocument()
  })

  it('shows the KEY STAT badge on avg monthly essential', async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('KEY STAT')).toBeInTheDocument()
    })
  })
})
