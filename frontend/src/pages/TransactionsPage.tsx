import { useState, useEffect, useCallback } from 'react'
import { useDateRange } from '@/contexts/DateRangeContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { TierBadge } from '@/components/shared/TierBadge'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { EditTransactionModal } from '@/components/shared/EditTransactionModal'
import { SplitTransactionModal } from '@/components/shared/SplitTransactionModal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Search, Pencil, Trash2, Copy, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import api from '@/api/client'
import type { Transaction, TransactionListResponse, Account, Category } from '@/types'

type SortField = 'date' | 'description' | 'amount' | 'tier' | null
type SortDir = 'asc' | 'desc'

export default function TransactionsPage() {
  const { dateParams } = useDateRange()
  const [data, setData] = useState<TransactionListResponse | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [accountFilter, setAccountFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [tierFilter, setTierFilter] = useState('all')
  const [flowFilter, setFlowFilter] = useState('all')
  const [uncategorisedOnly, setUncategorisedOnly] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [sortBy, setSortBy] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [jumpPage, setJumpPage] = useState('')

  // Modals
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [splitTx, setSplitTx] = useState<Transaction | null>(null)
  const [deleteTx, setDeleteTx] = useState<Transaction | null>(null)
  const [bulkCatOpen, setBulkCatOpen] = useState(false)
  const [bulkCatId, setBulkCatId] = useState('')
  const [bulkTier, setBulkTier] = useState('')
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = {
        page,
        page_size: 50,
        ...dateParams,
      }
      if (search) params.search = search
      if (accountFilter !== 'all') params.account_id = accountFilter
      if (categoryFilter !== 'all') params.category_id = categoryFilter
      if (tierFilter !== 'all') params.tier = tierFilter
      if (flowFilter !== 'all') params.flow_type = flowFilter
      if (uncategorisedOnly) params.uncategorised_only = true
      if (sortBy) params.sort_by = sortBy
      if (sortDir) params.sort_dir = sortDir

      const r = await api.get('/transactions', { params })
      setData(r.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, search, accountFilter, categoryFilter, tierFilter, flowFilter, uncategorisedOnly, sortBy, sortDir, dateParams])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  useEffect(() => {
    api.get('/accounts').then(r => setAccounts(r.data))
    api.get('/categories').then(r => setCategories(r.data))
  }, [])

  const handleDelete = async () => {
    if (!deleteTx) return
    try {
      await api.delete(`/transactions/${deleteTx.id}`)
      fetchTransactions()
    } catch (err) {
      console.error(err)
    }
  }

  const toggleSelect = (id: number) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const toggleAll = () => {
    if (!data) return
    if (selected.size === data.items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(data.items.map(t => t.id)))
    }
  }

  const handleBulkCategorise = async () => {
    if (!bulkCatId || selected.size === 0) return
    try {
      await api.post('/transactions/bulk-categorise', {
        transaction_ids: Array.from(selected),
        category_id: parseInt(bulkCatId),
        tier: bulkTier || null,
      })
      setSelected(new Set())
      setBulkCatOpen(false)
      fetchTransactions()
    } catch (err) {
      console.error(err)
    }
  }

  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    try {
      await api.post('/transactions/bulk-delete', {
        transaction_ids: Array.from(selected),
      })
      setSelected(new Set())
      setBulkDeleteOpen(false)
      fetchTransactions()
    } catch (err) {
      console.error(err)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
    setPage(1)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />
  }

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1

  const handleJumpPage = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const p = parseInt(jumpPage)
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        setPage(p)
      }
      setJumpPage('')
    }
  }

  // Generate page numbers to display
  const getPageNumbers = (): (number | '...')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    const pages: (number | '...')[] = []
    // Always show first page
    pages.push(1)
    if (page > 3) pages.push('...')
    // Pages around current
    const start = Math.max(2, page - 1)
    const end = Math.min(totalPages - 1, page + 1)
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    if (page < totalPages - 2) pages.push('...')
    // Always show last page
    if (totalPages > 1) pages.push(totalPages)
    return pages
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        {data && <span className="text-sm text-muted-foreground">{data.total} transactions</span>}
      </div>

      {/* Filters */}
      <Card className="bg-[#1a1a1a] border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <Select value={accountFilter} onValueChange={v => { setAccountFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.id.toString()}>{a.bank_name} — {a.account_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tierFilter} onValueChange={v => { setTierFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="Essential">Essential</SelectItem>
                <SelectItem value="Optional">Optional</SelectItem>
                <SelectItem value="Discretionary">Discretionary</SelectItem>
                <SelectItem value="Savings">Savings</SelectItem>
                <SelectItem value="Transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={flowFilter} onValueChange={v => { setFlowFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Flow Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="spending">Spending</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={uncategorisedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => { setUncategorisedOnly(v => !v); setPage(1) }}
              className={uncategorisedOnly ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
            >
              Uncategorised
            </Button>
          </div>

          {selected.size > 0 && (
            <div className="mt-3 flex items-center gap-3 p-2 bg-primary/10 rounded-md">
              <span className="text-sm text-primary">{selected.size} selected</span>
              <Button size="sm" variant="outline" onClick={() => setBulkCatOpen(true)}>
                Bulk Categorise
              </Button>
              <Button size="sm" variant="outline" className="text-red-400 border-red-400/50 hover:bg-red-400/10" onClick={() => setBulkDeleteOpen(true)}>
                Bulk Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-[#1a1a1a] border-border/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : !data || data.items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No transactions found</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.size === data.items.length && data.items.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:text-foreground"
                      onClick={() => handleSort('date')}
                    >
                      <span className="flex items-center">Date<SortIcon field="date" /></span>
                    </TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:text-foreground"
                      onClick={() => handleSort('description')}
                    >
                      <span className="flex items-center">Description<SortIcon field="description" /></span>
                    </TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:text-foreground"
                      onClick={() => handleSort('tier')}
                    >
                      <span className="flex items-center">Tier<SortIcon field="tier" /></span>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none hover:text-foreground"
                      onClick={() => handleSort('amount')}
                    >
                      <span className="flex items-center justify-end">Amount<SortIcon field="amount" /></span>
                    </TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(tx.id)}
                          onCheckedChange={() => toggleSelect(tx.id)}
                        />
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{tx.date}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tx.account_name}</TableCell>
                      <TableCell className="text-sm max-w-[250px] truncate">{tx.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tx.item || '—'}</TableCell>
                      <TableCell className="text-sm">{tx.category_name || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell><TierBadge tier={tx.tier} /></TableCell>
                      <TableCell className="text-right">
                        <AmountDisplay amount={tx.amount} direction={tx.direction} tier={tx.tier} flowType={tx.flow_type} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setSplitTx(tx)}
                            className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                            title="Split"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditTx(tx)}
                            className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTx(tx)}
                            className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t border-border/50">
                <span className="text-sm text-muted-foreground">
                  Page {data.page} of {totalPages} · {data.total} total
                </span>
                <div className="flex items-center gap-1">
                  {/* First */}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(1)}
                    className="px-2"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  {/* Prev */}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="px-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {/* Page numbers */}
                  {getPageNumbers().map((p, i) =>
                    p === '...' ? (
                      <span key={`ellipsis-${i}`} className="px-2 text-sm text-muted-foreground">…</span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === page ? "default" : "outline"}
                        size="sm"
                        className="px-3 min-w-[36px]"
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    )
                  )}

                  {/* Next */}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="px-2"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  {/* Last */}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(totalPages)}
                    className="px-2"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>

                  {/* Jump to page */}
                  {totalPages > 7 && (
                    <Input
                      placeholder="Go to…"
                      value={jumpPage}
                      onChange={e => setJumpPage(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={handleJumpPage}
                      className="w-[80px] ml-2 text-center text-sm"
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <EditTransactionModal
        open={!!editTx}
        onOpenChange={() => setEditTx(null)}
        transaction={editTx}
        onSaved={fetchTransactions}
      />
      <SplitTransactionModal
        open={!!splitTx}
        onOpenChange={() => setSplitTx(null)}
        transaction={splitTx}
        onSaved={fetchTransactions}
      />
      <ConfirmDialog
        open={!!deleteTx}
        onOpenChange={() => setDeleteTx(null)}
        title="Delete Transaction"
        description={`Delete "${deleteTx?.description}"? This cannot be undone.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        destructive
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={() => setBulkDeleteOpen(false)}
        title="Bulk Delete"
        description={`Delete ${selected.size} selected transaction${selected.size !== 1 ? 's' : ''}? This cannot be undone.`}
        onConfirm={handleBulkDelete}
        confirmLabel="Delete All"
        destructive
      />

      {/* Bulk Categorise Dialog */}
      {bulkCatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <Card className="w-full max-w-md bg-[#1a1a1a] border-border/50 p-6">
            <h3 className="text-lg font-semibold mb-4">Bulk Categorise ({selected.size} transactions)</h3>
            <div className="space-y-3">
              <Select value={bulkCatId} onValueChange={setBulkCatId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.group_name} → {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={bulkTier} onValueChange={setBulkTier}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tier (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Essential">Essential</SelectItem>
                  <SelectItem value="Optional">Optional</SelectItem>
                  <SelectItem value="Discretionary">Discretionary</SelectItem>
                  <SelectItem value="Savings">Savings</SelectItem>
                  <SelectItem value="Transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <Button variant="outline" onClick={() => setBulkCatOpen(false)}>Cancel</Button>
              <Button onClick={handleBulkCategorise} disabled={!bulkCatId}>Apply</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
