import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AmountDisplay } from '../AmountDisplay'

describe('AmountDisplay', () => {
  it('renders income amounts with + prefix and green colour', () => {
    render(<AmountDisplay amount={4500} direction="in" flowType="income" />)
    const el = screen.getByText('+£4,500.00')
    expect(el).toBeInTheDocument()
    expect(el).toHaveClass('text-green-400')
  })

  it('renders spending amounts with - prefix and red colour', () => {
    render(<AmountDisplay amount={-85.5} direction="out" flowType="spending" tier="Essential" />)
    const el = screen.getByText('-£85.50')
    expect(el).toBeInTheDocument()
    expect(el).toHaveClass('text-red-400')
  })

  it('renders neutral amounts (Savings tier) without sign prefix', () => {
    render(<AmountDisplay amount={-1000} direction="out" tier="Savings" />)
    const el = screen.getByText('£1,000.00')
    expect(el).toBeInTheDocument()
    expect(el).toHaveClass('text-gray-300')
  })

  it('renders Transfer tier as neutral', () => {
    render(<AmountDisplay amount={-500} direction="out" tier="Transfer" />)
    const el = screen.getByText('£500.00')
    expect(el).toBeInTheDocument()
    expect(el).toHaveClass('text-gray-300')
  })

  it('renders transfer flow_type as neutral', () => {
    render(<AmountDisplay amount={-200} direction="out" flowType="transfer" />)
    const el = screen.getByText('£200.00')
    expect(el).toBeInTheDocument()
    expect(el).toHaveClass('text-gray-300')
  })

  it('uses absolute value for display', () => {
    render(<AmountDisplay amount={-42.99} direction="out" flowType="spending" tier="Optional" />)
    expect(screen.getByText('-£42.99')).toBeInTheDocument()
  })

  it('formats zero amount correctly', () => {
    render(<AmountDisplay amount={0} direction="out" flowType="spending" />)
    // 0 is not income, not neutral, so should show as spending
    expect(screen.getByText('-£0.00')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<AmountDisplay amount={100} direction="in" flowType="income" className="text-lg" />)
    const el = screen.getByText('+£100.00')
    expect(el).toHaveClass('text-lg')
  })
})
