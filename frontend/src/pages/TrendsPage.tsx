import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useDateRange } from '@/contexts/DateRangeContext'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { formatCurrency, maskedCurrency, monthLabel, MASKED_AMOUNT } from '@/lib/utils'
import { TIER_CHART_COLORS } from '@/components/shared/TierBadge'
import api from '@/api/client'
import type { TrendsResponse } from '@/types'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const CATEGORY_COLORS = ['#f87171', '#fbbf24', '#60a5fa', '#a78bfa', '#34d399']

export default function TrendsPage() {
  const { dateParams } = useDateRange()
  const { hideAmounts } = usePrivacy()
  const [data, setData] = useState<TrendsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fc = (amount: number) => maskedCurrency(amount, hideAmounts)
  const tooltipFormatter = (value: any) => hideAmounts ? MASKED_AMOUNT : formatCurrency(Number(value))

  useEffect(() => {
    setLoading(true)
    api.get('/trends', { params: dateParams })
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [dateParams.date_from, dateParams.date_to])

  if (loading) return <div className="text-muted-foreground">Loading trends...</div>
  if (!data) return <div className="text-muted-foreground">No data available</div>

  // Build category trend line data
  const allMonths = new Set<string>()
  data.category_trends.forEach(ct => ct.data.forEach(d => allMonths.add(d.month)))
  const sortedMonths = Array.from(allMonths).sort()

  const categoryLineData = sortedMonths.map(month => {
    const point: any = { month: monthLabel(month) }
    data.category_trends.forEach(ct => {
      const found = ct.data.find(d => d.month === month)
      point[ct.category_name] = found?.amount || 0
    })
    return point
  })

  // Tier stacked area data
  const tierMonths = new Set<string>()
  data.tier_trends.forEach(tt => tt.data.forEach(d => tierMonths.add(d.month)))
  const sortedTierMonths = Array.from(tierMonths).sort()

  const tierAreaData = sortedTierMonths.map(month => {
    const point: any = { month: monthLabel(month) }
    data.tier_trends.forEach(tt => {
      const found = tt.data.find(d => d.month === month)
      point[tt.tier] = found?.amount || 0
    })
    return point
  })

  // Income vs Spending dual bar
  const incVsSpend = data.income_vs_spending.map(d => ({
    month: monthLabel(d.month),
    Income: d.income,
    Spending: d.spending,
    Savings: d.savings,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Trends</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category Spending Trends */}
        <Card className="bg-[#1a1a1a] border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Category Spending Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={categoryLineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 12 }} />
                <YAxis tick={{ fill: '#888', fontSize: 12 }} tickFormatter={v => hideAmounts ? '•••' : v} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #333', borderRadius: 8 }}
                  labelStyle={{ color: '#ccc' }}
                  formatter={tooltipFormatter}
                />
                <Legend />
                {data.category_trends.map((ct, i) => (
                  <Line
                    key={ct.category_name}
                    type="monotone"
                    dataKey={ct.category_name}
                    stroke={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tier Breakdown Over Time */}
        <Card className="bg-[#1a1a1a] border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tier Breakdown Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={tierAreaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 12 }} />
                <YAxis tick={{ fill: '#888', fontSize: 12 }} tickFormatter={v => hideAmounts ? '•••' : v} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #333', borderRadius: 8 }}
                  labelStyle={{ color: '#ccc' }}
                  formatter={tooltipFormatter}
                />
                <Legend />
                <Area type="monotone" dataKey="Essential" stackId="1" fill={TIER_CHART_COLORS.Essential} stroke={TIER_CHART_COLORS.Essential} fillOpacity={0.6} />
                <Area type="monotone" dataKey="Optional" stackId="1" fill={TIER_CHART_COLORS.Optional} stroke={TIER_CHART_COLORS.Optional} fillOpacity={0.6} />
                <Area type="monotone" dataKey="Discretionary" stackId="1" fill={TIER_CHART_COLORS.Discretionary} stroke={TIER_CHART_COLORS.Discretionary} fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Income vs Spending */}
      <Card className="bg-[#1a1a1a] border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Income vs Total Spending</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={incVsSpend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 12 }} />
              <YAxis tick={{ fill: '#888', fontSize: 12 }} tickFormatter={v => hideAmounts ? '•••' : v} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #333', borderRadius: 8 }}
                labelStyle={{ color: '#ccc' }}
                formatter={tooltipFormatter}
              />
              <Legend />
              <Bar dataKey="Income" fill="#4ade80" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Spending" fill="#f87171" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Spending Categories */}
      <Card className="bg-[#1a1a1a] border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Top Spending Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.top_categories.map((cat, i) => (
              <div key={cat.category_name} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{cat.category_name}</span>
                    <span className="text-sm text-muted-foreground">{fc(cat.total)}</span>
                  </div>
                  <div className="h-2 bg-[#222] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${cat.percentage}%`,
                        backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                      }}
                    />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground w-12 text-right">
                  {cat.percentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
