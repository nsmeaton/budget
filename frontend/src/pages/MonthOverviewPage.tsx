import { useState, useEffect, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { TierBadge, TIER_CHART_COLORS } from '@/components/shared/TierBadge'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { formatCurrency, maskedCurrency, MASKED_AMOUNT } from '@/lib/utils'
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import api from '@/api/client'
import type { Transaction, Category } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const TIERS = ['Essential', 'Optional', 'Discretionary', 'Savings', 'Transfer']
const FLOW_TYPES = ['income', 'spending', 'transfer']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function getMonthRange(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

type SortField = 'date' | 'description' | 'amount' | 'category_name' | 'tier'
type SortDir = 'asc' | 'desc'

export default function MonthOverviewPage() {
  const now = new Date()
  const { hideAmounts } = usePrivacy()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [tierFilter, setTierFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [flowFilter, setFlowFilter] = useState('all')

  // Sort
  const [sortBy, setSortBy] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const { from, to } = getMonthRange(year, month)

  const fc = (amount: number) => maskedCurrency(amount, hideAmounts)
  const tooltipFormatter = (value: any) => hideAmounts ? MASKED_AMOUNT : formatCurrency(Number(value))

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data)).catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    api.get('/transactions', {
      params: { date_from: from, date_to: to, page: 1, page_size: 500 },
    })
      .then(r => setTransactions(r.data.items))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [from, to])

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      if (tierFilter !== 'all' && tx.tier !== tierFilter) return false
      if (categoryFilter !== 'all' && tx.category_id?.toString() !== categoryFilter) return false
      if (flowFilter !== 'all' && tx.flow_type !== flowFilter) return false
      return true
    })
  }, [transactions, tierFilter, categoryFilter, flowFilter])

  // Sorted transactions
  const sorted = useMemo(() => {
    const items = [...filtered]
    items.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'date': cmp = a.date.localeCompare(b.date); break
        case 'description': cmp = a.description.localeCompare(b.description); break
        case 'amount': cmp = Math.abs(a.amount) - Math.abs(b.amount); break
        case 'category_name': cmp = (a.category_name || '').localeCompare(b.category_name || ''); break
        case 'tier': cmp = (a.tier || '').localeCompare(b.tier || ''); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return items
  }, [filtered, sortBy, sortDir])

  // Aggregations for charts (from unfiltered month data)
  const tierData = useMemo(() => {
    const map: Record<string, number> = {}
    transactions.forEach(tx => {
      if (tx.direction === 'out' || tx.flow_type === 'spending') {
        const tier = tx.tier || 'Uncategorised'
        if (tier !== 'Savings' && tier !== 'Transfer') {
          map[tier] = (map[tier] || 0) + Math.abs(tx.amount)
        }
      }
    })
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
  }, [transactions])

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {}
    transactions.forEach(tx => {
      if (tx.direction === 'out' || tx.flow_type === 'spending') {
        const cat = tx.category_name || 'Uncategorised'
        map[cat] = (map[cat] || 0) + Math.abs(tx.amount)
      }
    })
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15)
  }, [transactions])

  const incomeVsSpending = useMemo(() => {
    let income = 0, spending = 0, savings = 0, transfers = 0
    transactions.forEach(tx => {
      const isNeutralTier = tx.tier === 'Savings' || tx.tier === 'Transfer' || tx.flow_type === 'transfer'
      if (tx.tier === 'Savings') {
        savings += Math.abs(tx.amount)
      } else if (tx.tier === 'Transfer' || tx.flow_type === 'transfer') {
        transfers += Math.abs(tx.amount)
      } else if (tx.flow_type === 'income' || (tx.direction === 'in' && !isNeutralTier)) {
        income += Math.abs(tx.amount)
      } else if (tx.direction === 'out' || tx.flow_type === 'spending') {
        spending += Math.abs(tx.amount)
      }
    })
    return { income, spending, savings, transfers }
  }, [transactions])

  const summaryChartData = [
    { name: 'Income', value: incomeVsSpending.income, fill: '#4ade80' },
    { name: 'Spending', value: incomeVsSpending.spending, fill: '#f87171' },
    { name: 'Savings', value: incomeVsSpending.savings, fill: '#a78bfa' },
    { name: 'Transfers', value: incomeVsSpending.transfers, fill: '#9ca3af' },
  ]

  // Totals for the filtered table
  const totals = useMemo(() => {
    let income = 0, spending = 0
    filtered.forEach(tx => {
      if (tx.flow_type === 'income' || (tx.direction === 'in' && tx.flow_type !== 'transfer' && tx.tier !== 'Savings' && tx.tier !== 'Transfer')) {
        income += Math.abs(tx.amount)
      } else if (tx.direction === 'out' || tx.flow_type === 'spending') {
        spending += Math.abs(tx.amount)
      }
    })
    return { income, spending, count: filtered.length }
  }, [filtered])

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />
  }

  const PIE_COLORS = [
    TIER_CHART_COLORS.Essential,
    TIER_CHART_COLORS.Optional,
    TIER_CHART_COLORS.Discretionary,
    '#6ee7b7', '#f9a8d4', '#93c5fd', '#fcd34d', '#c4b5fd',
  ]

  return (
    <div className="space-y-6">
      {/* Header with month navigation */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Month Overview</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Select value={month.toString()} onValueChange={v => setMonth(parseInt(v))}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={year.toString()} onValueChange={v => setYear(parseInt(v))}>
              <SelectTrigger className="w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : transactions.length === 0 ? (
        <div className="text-muted-foreground">No transactions for {MONTH_NAMES[month - 1]} {year}</div>
      ) : (
        <>
          {/* KPI summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-[#1a1a1a] border-border/50">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Income</p>
                <p className="text-2xl font-bold text-green-400">{fc(incomeVsSpending.income)}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#1a1a1a] border-border/50">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Spending</p>
                <p className="text-2xl font-bold text-red-400">{fc(incomeVsSpending.spending)}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#1a1a1a] border-border/50">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Savings</p>
                <p className="text-2xl font-bold text-purple-400">{fc(incomeVsSpending.savings)}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#1a1a1a] border-border/50">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Net</p>
                <p className={`text-2xl font-bold ${incomeVsSpending.income - incomeVsSpending.spending - incomeVsSpending.savings >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fc(incomeVsSpending.income - incomeVsSpending.spending - incomeVsSpending.savings)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Income vs Spending bar */}
            <Card className="bg-[#1a1a1a] border-border/50">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={summaryChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" tick={{ fill: '#888', fontSize: 12 }} tickFormatter={v => hideAmounts ? '•••' : v} />
                    <YAxis dataKey="name" type="category" tick={{ fill: '#888', fontSize: 12 }} width={70} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #333', borderRadius: 8 }}
                      labelStyle={{ color: '#ccc' }}
                      formatter={tooltipFormatter}
                    />
                    <Bar dataKey="value" radius={[0, 2, 2, 0]}>
                      {summaryChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Spending by tier pie */}
            <Card className="bg-[#1a1a1a] border-border/50">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Spending by Tier</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={tierData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {tierData.map((entry, i) => (
                        <Cell key={i} fill={TIER_CHART_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #333', borderRadius: 8 }}
                      formatter={tooltipFormatter}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Spending by category pie */}
            <Card className="bg-[#1a1a1a] border-border/50">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Spending by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }: any) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={true}
                    >
                      {categoryData.map((_entry, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #333', borderRadius: 8 }}
                      formatter={tooltipFormatter}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top categories bar */}
            <Card className="bg-[#1a1a1a] border-border/50">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Top Spending Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" tick={{ fill: '#888', fontSize: 12 }} tickFormatter={v => hideAmounts ? '•••' : v} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fill: '#888', fontSize: 10 }}
                      width={100}
                      interval={0}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #333', borderRadius: 8 }}
                      formatter={tooltipFormatter}
                    />
                    <Bar dataKey="value" fill="#60a5fa" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="bg-[#1a1a1a] border-border/50">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <Select value={tierFilter} onValueChange={setTierFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    {TIERS.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={flowFilter} onValueChange={setFlowFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {FLOW_TYPES.map(f => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(tierFilter !== 'all' || categoryFilter !== 'all' || flowFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setTierFilter('all'); setCategoryFilter('all'); setFlowFilter('all') }}
                  >
                    Clear filters
                  </Button>
                )}

                <span className="text-xs text-muted-foreground ml-auto">
                  {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Table */}
          <Card className="bg-[#1a1a1a] border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort('date')}
                    >
                      <span className="flex items-center">Date<SortIcon field="date" /></span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort('description')}
                    >
                      <span className="flex items-center">Description<SortIcon field="description" /></span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort('category_name')}
                    >
                      <span className="flex items-center">Category<SortIcon field="category_name" /></span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort('tier')}
                    >
                      <span className="flex items-center">Tier<SortIcon field="tier" /></span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right"
                      onClick={() => toggleSort('amount')}
                    >
                      <span className="flex items-center justify-end">Amount<SortIcon field="amount" /></span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No transactions match filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    sorted.map(tx => (
                      <TableRow key={tx.id} className="hover:bg-muted/20">
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{tx.date}</TableCell>
                        <TableCell className="text-sm max-w-[300px] truncate">{tx.description}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{tx.category_name || '—'}</TableCell>
                        <TableCell><TierBadge tier={tx.tier} /></TableCell>
                        <TableCell className="text-right">
                          <AmountDisplay
                            amount={tx.amount}
                            direction={tx.direction}
                            tier={tx.tier}
                            flowType={tx.flow_type}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {/* Totals row */}
                  {sorted.length > 0 && (
                    <TableRow className="border-t-2 border-border/50 font-semibold">
                      <TableCell colSpan={3} className="text-sm">
                        {totals.count} transaction{totals.count !== 1 ? 's' : ''}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {totals.income > 0 && <span className="text-green-400">In: {fc(totals.income)}</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {totals.spending > 0 && <span className="text-red-400">Out: {fc(totals.spending)}</span>}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
