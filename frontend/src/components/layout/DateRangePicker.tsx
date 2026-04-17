import { ChevronDown } from 'lucide-react'
import { useDateRange } from '@/contexts/DateRangeContext'
import { format } from 'date-fns'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function DateRangePicker() {
  const { dateRange, year, setYear } = useDateRange()
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i)

  return (
    <div className="flex items-center gap-3">
      <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
        <SelectTrigger className="w-[100px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={y.toString()}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">
        {format(dateRange.from, 'dd MMM')} — {format(dateRange.to, 'dd MMM yyyy')}
      </span>
    </div>
  )
}
