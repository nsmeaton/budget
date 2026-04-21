import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useDateRange } from '@/contexts/DateRangeContext'
import { formatCurrency, formatPercent, monthLabel } from '@/lib/utils'
import { TIER_CHART_COLORS } from '@/components/shared/TierBadge'
import api from '@/api/client'
import type { DashboardResponse } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

export default function DashboardPage() {
  const { dateParams } = useDateRange()
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get('/dashboard', { params: dateParams })
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [dateParams.date_from, dateParams.date_to])

  if (loading) return <div className="text-muted-foreground">Loading dashboard...</div>
  if (!data) return <div className="text-muted-foreground">No data available</div>

  const { kpis, monthly_breakdown } = data

  // Chart data
  const incomeVsSpending = monthly_breakdown.map(m => ({
    month: monthLabel(m.month),
    Income: m.income_total,
    Spending: m.spending_total,
  }))

  const spendingByTier = monthly_breakdown.map(m => ({
    month: monthLabel(m.month),
    Essential: m.spending_essential,
    Optional: m.spending_optional,
    Discretionary: m.spending_discretionary,
  }))

  const savingsPerMonth = monthly_breakdown.map(m => ({
    month: monthLabel(m.month),
    Savings: m.savings,
  }))

  const totalSavingsChart = monthly_breakdown.reduce((s, m) => s + m.savings, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="Total Income"
          value={formatCurrency(kpis.total_income)}
          change={kpis.income_change_pct}
          color="text-green-400"
        />
        <KPICard
          title="Total Spending"
          value={formatCurrency(kpis.total_spending)}
          subtitle="Essential + Optional + Disc."
          color="text-red-400"
        />
        <KPICard
          title="Avg Monthly Essential"
          value={formatCurrency(kpis.avg_monthly_essential)}
          subtitle="Your baseline cost of living"
          color="text-red-300"
          badge="KEY STAT"
        />
        <KPICard
          title="Avg Monthly Ess. + Opt."
          value={formatCurrency(kpis.avg_monthly_essential_optional)}
          subtitle="Comfortable monthly spend"
          color="text-amber-400"
        />
        <KPICard
          title="Total Savings"
          value={formatCurrency(kpis.total_savings)}
          subtitle={`Savings rate: ${kpis.savings_rate.toFixed(1)}%`}
          color="text-green-400"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-[#1a1a1a] border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Income vs Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={incomeVsSpending}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 12 }} />
                <YAxis tick={{ fill: '#888', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #333', borderRadius: 8 }}
                  labelStyle={{ color: '#ccc' }}
                />
                <Legend />
                <Bar dataKey="Income" fill="#4ade80" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Spending" fill="#f87171" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Spending by Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={spendingByTier}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 12 }} />
                <YAxis tick={{ fill: '#888', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #333', borderRadius: 8 }}
                  labelStyle={{ color: '#ccc' }}
                />
                <Legend />
                <Bar dataKey="Essential" stackId="a" fill={TIER_CHART_COLORS.Essential} />
                <Bar dataKey="Optional" stackId="a" fill={TIER_CHART_COLORS.Optional} />
                <Bar dataKey="Discretionary" stackId="a" fill={TIER_CHART_COLORS.Discretionary} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Savings Chart */}
      <Card className="bg-[#1a1a1a] border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Savings per Month
            <span className="ml-2 text-xs text-muted-foreground">
              Total: {formatCurrency(totalSavingsChart)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={savingsPerMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 12 }} />
              <YAxis tick={{ fill: '#888', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #333', borderRadius: 8 }}
                labelStyle={{ color: '#ccc' }}
              />
              <Bar dataKey="Savings" fill="#a78bfa" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table */}
      <Card className="bg-[#1a1a1a] border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Monthly Breakdown</CardTitle>
          <p className="text-xs text-muted-foreground">Click any cell to drill in</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <MonthlyBreakdownTable breakdown={monthly_breakdown} />
        </CardContent>
      </Card>
    </div>
  )
}

function KPICard({ title, value, subtitle, change, color, badge }: {
  title: string
  value: string
  subtitle?: string
  change?: number | null
  color: string
  badge?: string
}) {
  return (
    <Card className="bg-[#1a1a1a] border-border/50">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground">{title}</p>
          {badge && (
            <span className="text-[10px] font-bold text-red-300 bg-red-500/10 px-1.5 py-0.5 rounded">
              {badge}
            </span>
          )}
        </div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {change != null && (
          <p className="text-xs text-muted-foreground mt-1">
            {formatPercent(change)} vs last period
          </p>
        )}
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

function MonthlyBreakdownTable({ breakdown }: { breakdown: DashboardResponse['monthly_breakdown'] }) {
  const months = breakdown.sort((a, b) => a.month.localeCompare(b.month))

  type RowDef = { label: string; key: string; indent?: boolean; bold?: boolean; color?: string }
  const rows: RowDef[] = [
    { label: 'INCOME', key: 'income_total', bold: true, color: 'text-green-400' },
    { label: 'Salary', key: 'income_salary', indent: true },
    { label: 'Bonus', key: 'income_bonus', indent: true },
    { label: 'RSU', key: 'income_rsu', indent: true },
    { label: 'Investments', key: 'income_investments', indent: true },
    { label: 'SPENDING', key: 'spending_total', bold: true, color: 'text-red-400' },
    { label: 'Essential', key: 'spending_essential', indent: true, color: 'text-red-300' },
    { label: 'Optional', key: 'spending_optional', indent: true, color: 'text-amber-400' },
    { label: 'Discretionary', key: 'spending_discretionary', indent: true, color: 'text-blue-400' },
    { label: 'SAVINGS', key: 'savings', bold: true, color: 'text-purple-400' },
    { label: 'NET', key: 'net', bold: true },
  ]

  const getTotal = (key: string) =>
    months.reduce((sum, m) => sum + ((m as any)[key] || 0), 0)

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border/50">
          <th className="text-left py-2 px-2 text-muted-foreground font-medium">Category</th>
          {months.map(m => (
            <th key={m.month} className="text-right py-2 px-2 text-muted-foreground font-medium">
              {monthLabel(m.month)}
            </th>
          ))}
          <th className="text-right py-2 px-2 text-muted-foreground font-medium">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.key} className="border-b border-border/20 hover:bg-muted/20">
            <td className={`py-1.5 px-2 ${row.indent ? 'pl-6' : ''} ${row.bold ? 'font-semibold' : ''} ${row.color || ''}`}>
              {row.label}
            </td>
            {months.map(m => {
              const val = (m as any)[row.key] || 0
              return (
                <td key={m.month} className={`text-right py-1.5 px-2 ${row.color || ''} ${row.bold ? 'font-semibold' : ''}`}>
                  {val !== 0 ? formatCurrency(Math.abs(val)) : '—'}
                </td>
              )
            })}
            <td className={`text-right py-1.5 px-2 font-semibold ${row.color || ''}`}>
              {formatCurrency(Math.abs(getTotal(row.key)))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
