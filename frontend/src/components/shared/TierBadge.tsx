import { cn } from '@/lib/utils'

const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  Essential: { bg: 'bg-red-500/20', text: 'text-red-400' },
  Optional: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  Discretionary: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  Savings: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  Transfer: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
}

export function TierBadge({ tier }: { tier: string | null | undefined }) {
  if (!tier) return <span className="text-muted-foreground text-xs">—</span>
  const colors = TIER_COLORS[tier] || { bg: 'bg-gray-500/20', text: 'text-gray-400' }
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', colors.bg, colors.text)}>
      {tier}
    </span>
  )
}

export const TIER_CHART_COLORS: Record<string, string> = {
  Essential: '#f87171',
  Optional: '#fbbf24',
  Discretionary: '#60a5fa',
  Savings: '#a78bfa',
  Transfer: '#9ca3af',
}
