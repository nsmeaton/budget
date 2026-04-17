import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TierBadge } from '../TierBadge'

describe('TierBadge', () => {
  it('renders Essential tier with correct text', () => {
    render(<TierBadge tier="Essential" />)
    expect(screen.getByText('Essential')).toBeInTheDocument()
  })

  it('renders Optional tier with correct text', () => {
    render(<TierBadge tier="Optional" />)
    expect(screen.getByText('Optional')).toBeInTheDocument()
  })

  it('renders Discretionary tier with correct text', () => {
    render(<TierBadge tier="Discretionary" />)
    expect(screen.getByText('Discretionary')).toBeInTheDocument()
  })

  it('renders Savings tier with correct text', () => {
    render(<TierBadge tier="Savings" />)
    expect(screen.getByText('Savings')).toBeInTheDocument()
  })

  it('renders Transfer tier with correct text', () => {
    render(<TierBadge tier="Transfer" />)
    expect(screen.getByText('Transfer')).toBeInTheDocument()
  })

  it('renders a dash for null tier', () => {
    render(<TierBadge tier={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders a dash for undefined tier', () => {
    render(<TierBadge tier={undefined} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('applies badge styling classes for valid tiers', () => {
    render(<TierBadge tier="Essential" />)
    const badge = screen.getByText('Essential')
    expect(badge).toHaveClass('text-xs')
    expect(badge).toHaveClass('font-medium')
    expect(badge).toHaveClass('rounded-md')
  })

  it('handles unknown tier gracefully with fallback styling', () => {
    render(<TierBadge tier="SomethingUnknown" />)
    expect(screen.getByText('SomethingUnknown')).toBeInTheDocument()
  })
})
