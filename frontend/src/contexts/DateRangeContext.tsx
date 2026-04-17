import React, { createContext, useContext, useState } from 'react'
import { format, startOfYear, endOfYear } from 'date-fns'

interface DateRange {
  from: Date
  to: Date
}

interface DateRangeState {
  dateRange: DateRange
  setDateRange: (range: DateRange) => void
  dateParams: { date_from: string; date_to: string }
  year: number
  setYear: (y: number) => void
}

const DateRangeContext = createContext<DateRangeState | undefined>(undefined)

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const currentYear = new Date().getFullYear()
  const [year, setYearState] = useState(currentYear)
  const [dateRange, setDateRangeState] = useState<DateRange>({
    from: startOfYear(new Date(currentYear, 0, 1)),
    to: endOfYear(new Date(currentYear, 0, 1)),
  })

  const setDateRange = (range: DateRange) => {
    setDateRangeState(range)
  }

  const setYear = (y: number) => {
    setYearState(y)
    setDateRangeState({
      from: startOfYear(new Date(y, 0, 1)),
      to: endOfYear(new Date(y, 0, 1)),
    })
  }

  const dateParams = {
    date_from: format(dateRange.from, 'yyyy-MM-dd'),
    date_to: format(dateRange.to, 'yyyy-MM-dd'),
  }

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange, dateParams, year, setYear }}>
      {children}
    </DateRangeContext.Provider>
  )
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext)
  if (!ctx) throw new Error('useDateRange must be used within DateRangeProvider')
  return ctx
}
