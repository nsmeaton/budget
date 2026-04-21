import { formatCurrency, MASKED_AMOUNT } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { usePrivacy } from '@/contexts/PrivacyContext'

interface AmountDisplayProps {
  amount: number
  direction?: string
  tier?: string | null
  flowType?: string | null
  className?: string
}

export function AmountDisplay({ amount, direction, tier, flowType, className }: AmountDisplayProps) {
  const { hideAmounts } = usePrivacy()
  const isNeutral = tier === 'Savings' || tier === 'Transfer' || flowType === 'transfer'
  const isIncome = !isNeutral && (flowType === 'income' || (direction === 'in' && flowType !== 'spending'))

  let displayAmount: string
  let colorClass: string

  if (isNeutral) {
    displayAmount = hideAmounts ? MASKED_AMOUNT : formatCurrency(Math.abs(amount))
    colorClass = 'text-gray-300'
  } else if (isIncome) {
    displayAmount = hideAmounts ? `+${MASKED_AMOUNT}` : `+${formatCurrency(Math.abs(amount))}`
    colorClass = 'text-green-400'
  } else {
    displayAmount = hideAmounts ? `-${MASKED_AMOUNT}` : `-${formatCurrency(Math.abs(amount))}`
    colorClass = 'text-red-400'
  }

  return <span className={cn(colorClass, className)}>{displayAmount}</span>
}
