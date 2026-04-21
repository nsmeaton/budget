import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, opts?: { showSign?: boolean; absolute?: boolean }): string {
  const abs = opts?.absolute ? Math.abs(amount) : amount
  const formatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(abs))

  if (opts?.showSign) {
    if (amount > 0) return `+${formatted}`
    if (amount < 0) return `-${formatted}`
  } else if (amount < 0 && !opts?.absolute) {
    return `-${formatted}`
  }
  return formatted
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function monthLabel(m: string): string {
  // "2025-01" -> "Jan"
  const [, month] = m.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[parseInt(month, 10) - 1] || m
}

export const MASKED_AMOUNT = '£•••••'

export function maskedCurrency(amount: number, hidden: boolean, opts?: { showSign?: boolean; absolute?: boolean }): string {
  if (hidden) return MASKED_AMOUNT
  return formatCurrency(amount, opts)
}
