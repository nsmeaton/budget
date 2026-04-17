import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { TierBadge } from '@/components/shared/TierBadge'
import { Upload, CheckCircle } from 'lucide-react'
import api from '@/api/client'
import type { Account, Category, CSVPreviewResponse, ImportResult, Transaction } from '@/types'

const STEPS = ['Account', 'Upload', 'Mapping', 'Duplicates', 'Auto-match', 'Review']
const DATE_FORMATS = ['DD/MM/YYYY', 'DD-MM-YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YY', 'DD Mon YYYY']
const TIERS = ['Essential', 'Optional', 'Discretionary', 'Savings', 'Transfer']

export default function ImportPage() {
  const [step, setStep] = useState(0)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CSVPreviewResponse | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [uncategorisedTxs, setUncategorisedTxs] = useState<Transaction[]>([])

  // Mapping state
  const [dateCol, setDateCol] = useState<string>('')
  const [descCol, setDescCol] = useState<string>('')
  const [amountCol, setAmountCol] = useState<string>('')
  const [debitCol, setDebitCol] = useState<string>('')
  const [creditCol, setCreditCol] = useState<string>('')
  const [balanceCol, setBalanceCol] = useState<string>('')
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY')
  const [hasHeader, setHasHeader] = useState(true)

  // Duplicate skip
  const [skipRows, setSkipRows] = useState<Set<number>>(new Set())

  // New account form
  const [showNewAccount, setShowNewAccount] = useState(false)
  const [newBankName, setNewBankName] = useState('')
  const [newAccountName, setNewAccountName] = useState('')

  useEffect(() => {
    api.get('/accounts').then(r => setAccounts(r.data))
    api.get('/categories').then(r => setCategories(r.data))
  }, [])

  // Populate mapping from bank profile
  useEffect(() => {
    if (selectedAccountId) {
      const acct = accounts.find(a => a.id === selectedAccountId)
      if (acct?.bank_profile) {
        const bp = acct.bank_profile
        setDateCol(bp.date_column.toString())
        setDescCol(bp.description_column.toString())
        setAmountCol(bp.amount_column?.toString() || '')
        setDebitCol(bp.debit_column?.toString() || '')
        setCreditCol(bp.credit_column?.toString() || '')
        setBalanceCol(bp.balance_column?.toString() || '')
        setDateFormat(bp.date_format)
        setHasHeader(bp.has_header)
      }
    }
  }, [selectedAccountId, accounts])

  const handleUpload = async () => {
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const r = await api.post('/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setPreview(r.data)
      setStep(2)
    } catch (err) {
      console.error(err)
    }
  }

  const handleProcess = async () => {
    if (!file || !selectedAccountId) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('account_id', selectedAccountId.toString())
    formData.append('date_column', dateCol)
    formData.append('description_column', descCol)
    if (amountCol) formData.append('amount_column', amountCol)
    if (debitCol) formData.append('debit_column', debitCol)
    if (creditCol) formData.append('credit_column', creditCol)
    if (balanceCol) formData.append('balance_column', balanceCol)
    formData.append('date_format', dateFormat)
    formData.append('has_header', hasHeader.toString())
    formData.append('save_profile', 'true')

    try {
      const r = await api.post('/import/process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportResult(r.data)

      if (r.data.duplicates_flagged > 0) {
        setStep(3)
      } else if (r.data.auto_categorised > 0) {
        setStep(4)
      } else if (r.data.uncategorised_ids.length > 0) {
        await fetchUncategorised(r.data.uncategorised_ids)
        setStep(5)
      } else {
        setStep(5)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchUncategorised = async (ids: number[]) => {
    if (ids.length === 0) return
    try {
      const r = await api.get('/transactions', {
        params: { page: 1, page_size: 200, uncategorised_only: true },
      })
      setUncategorisedTxs(r.data.items)
    } catch (err) {
      console.error(err)
    }
  }

  const handleConfirmDuplicates = async () => {
    try {
      await api.post('/import/confirm', { skip_row_indices: Array.from(skipRows) })
      if (importResult && importResult.needs_review > 0 && importResult.uncategorised_ids.length > 0) {
        await fetchUncategorised(importResult.uncategorised_ids)
        setStep(5)
      } else {
        setStep(4)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateAccount = async () => {
    try {
      const r = await api.post('/accounts', { bank_name: newBankName, account_name: newAccountName })
      setAccounts([...accounts, r.data])
      setSelectedAccountId(r.data.id)
      setShowNewAccount(false)
      setNewBankName('')
      setNewAccountName('')
    } catch (err) {
      console.error(err)
    }
  }

  const selectedAccount = accounts.find(a => a.id === selectedAccountId)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Import Transactions</h1>

      {/* Stepper */}
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                i === step
                  ? 'bg-primary text-primary-foreground'
                  : i < step
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < step ? <CheckCircle className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}
              <span>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 0: Account Selection */}
      {step === 0 && (
        <Card className="bg-[#1a1a1a] border-border/50">
          <CardHeader>
            <CardTitle className="text-sm">Select Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              {accounts.map(acct => (
                <button
                  key={acct.id}
                  onClick={() => setSelectedAccountId(acct.id)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    selectedAccountId === acct.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border/50 hover:border-border'
                  }`}
                >
                  <p className="font-medium text-sm">{acct.bank_name} — {acct.account_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {acct.bank_profile ? `Mapping: saved` : 'No mapping profile'} ·{' '}
                    {acct.last_import_date ? `Last import: ${acct.last_import_date}` : 'Never imported'}
                  </p>
                </button>
              ))}
            </div>

            {!showNewAccount ? (
              <Button variant="outline" size="sm" onClick={() => setShowNewAccount(true)}>
                + New Account
              </Button>
            ) : (
              <div className="space-y-2 p-3 border border-border/50 rounded-lg">
                <Input placeholder="Bank name" value={newBankName} onChange={e => setNewBankName(e.target.value)} />
                <Input placeholder="Account name" value={newAccountName} onChange={e => setNewAccountName(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateAccount} disabled={!newBankName || !newAccountName}>
                    Create
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewAccount(false)}>Cancel</Button>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setStep(1)} disabled={!selectedAccountId}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card className="bg-[#1a1a1a] border-border/50">
          <CardHeader>
            <CardTitle className="text-sm">Upload CSV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border-2 border-dashed border-border/50 rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f) setFile(f)
              }}
              onClick={() => document.getElementById('csv-input')?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {file ? file.name : 'Drop CSV file here or click to browse'}
              </p>
              <input
                id="csv-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
              <Button onClick={handleUpload} disabled={!file}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Mapping */}
      {step === 2 && preview && (
        <Card className="bg-[#1a1a1a] border-border/50">
          <CardHeader>
            <CardTitle className="text-sm">Column Mapping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Preview table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    {preview.headers.map((h, i) => (
                      <th key={i} className="text-left py-2 px-2 text-muted-foreground">{h || `Col ${i}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((row, ri) => (
                    <tr key={ri} className="border-b border-border/20">
                      {row.map((cell, ci) => (
                        <td key={ci} className="py-1.5 px-2">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mapping dropdowns */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date Column *</Label>
                <Select value={dateCol} onValueChange={setDateCol}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {preview.headers.map((h, i) => (
                      <SelectItem key={i} value={i.toString()}>{h || `Col ${i}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description Column *</Label>
                <Select value={descCol} onValueChange={setDescCol}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {preview.headers.map((h, i) => (
                      <SelectItem key={i} value={i.toString()}>{h || `Col ${i}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amount Column</Label>
                <Select value={amountCol} onValueChange={setAmountCol}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {preview.headers.map((h, i) => (
                      <SelectItem key={i} value={i.toString()}>{h || `Col ${i}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Debit Column</Label>
                <Select value={debitCol} onValueChange={setDebitCol}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {preview.headers.map((h, i) => (
                      <SelectItem key={i} value={i.toString()}>{h || `Col ${i}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Credit Column</Label>
                <Select value={creditCol} onValueChange={setCreditCol}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {preview.headers.map((h, i) => (
                      <SelectItem key={i} value={i.toString()}>{h || `Col ${i}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Balance Column</Label>
                <Select value={balanceCol} onValueChange={setBalanceCol}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {preview.headers.map((h, i) => (
                      <SelectItem key={i} value={i.toString()}>{h || `Col ${i}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date Format</Label>
                <Select value={dateFormat} onValueChange={setDateFormat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DATE_FORMATS.map(f => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Checkbox
                  checked={hasHeader}
                  onCheckedChange={(v) => setHasHeader(!!v)}
                />
                <Label className="text-xs">Has header row</Label>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={handleProcess} disabled={!dateCol || !descCol}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Duplicates */}
      {step === 3 && importResult && (
        <Card className="bg-[#1a1a1a] border-border/50">
          <CardHeader>
            <CardTitle className="text-sm">Duplicate Review</CardTitle>
            <p className="text-xs text-muted-foreground">{importResult.duplicates_flagged} potential duplicates found</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Skip?</TableHead>
                  <TableHead>CSV Row</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Existing Match</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importResult.duplicate_candidates.map(dup => (
                  <TableRow key={dup.csv_row}>
                    <TableCell>
                      <Checkbox
                        checked={skipRows.has(dup.csv_row)}
                        onCheckedChange={(v) => {
                          const next = new Set(skipRows)
                          if (v) next.add(dup.csv_row)
                          else next.delete(dup.csv_row)
                          setSkipRows(next)
                        }}
                      />
                    </TableCell>
                    <TableCell>{dup.csv_row}</TableCell>
                    <TableCell>{dup.date}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{dup.description}</TableCell>
                    <TableCell>£{Math.abs(dup.amount).toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dup.existing_date} · {dup.existing_description} · £{Math.abs(dup.existing_amount).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handleConfirmDuplicates}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Auto-match results */}
      {step === 4 && importResult && (
        <Card className="bg-[#1a1a1a] border-border/50">
          <CardHeader>
            <CardTitle className="text-sm">Auto-Categorisation Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-[#111] rounded-lg">
                <p className="text-2xl font-bold">{importResult.total_rows}</p>
                <p className="text-xs text-muted-foreground">Total Rows</p>
              </div>
              <div className="p-3 bg-[#111] rounded-lg">
                <p className="text-2xl font-bold text-green-400">{importResult.imported}</p>
                <p className="text-xs text-muted-foreground">Imported</p>
              </div>
              <div className="p-3 bg-[#111] rounded-lg">
                <p className="text-2xl font-bold text-blue-400">{importResult.auto_categorised}</p>
                <p className="text-xs text-muted-foreground">Auto-categorised</p>
              </div>
              <div className="p-3 bg-[#111] rounded-lg">
                <p className="text-2xl font-bold text-amber-400">{importResult.needs_review}</p>
                <p className="text-xs text-muted-foreground">Need Review</p>
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={async () => {
                if (importResult.uncategorised_ids.length > 0) {
                  await fetchUncategorised(importResult.uncategorised_ids)
                }
                setStep(5)
              }}>
                {importResult.needs_review > 0 ? 'Review Uncategorised' : 'Finish'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Review uncategorised */}
      {step === 5 && (
        <Card className="bg-[#1a1a1a] border-border/50">
          <CardHeader>
            <CardTitle className="text-sm">Review Uncategorised Transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {uncategorisedTxs.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-400" />
                <p className="text-lg font-medium">All done!</p>
                <p className="text-sm text-muted-foreground">
                  {importResult ? `${importResult.imported} transactions imported successfully.` : 'Import complete.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {uncategorisedTxs.map(tx => (
                  <UncategorisedRow
                    key={tx.id}
                    transaction={tx}
                    categories={categories}
                    onSaved={() => {
                      setUncategorisedTxs(prev => prev.filter(t => t.id !== tx.id))
                    }}
                  />
                ))}
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(4)}>Back</Button>
              <Button onClick={() => setStep(0)}>Start New Import</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function UncategorisedRow({
  transaction,
  categories,
  onSaved,
}: {
  transaction: Transaction
  categories: Category[]
  onSaved: () => void
}) {
  const [catId, setCatId] = useState('')
  const [tier, setTier] = useState('')

  const handleSave = async () => {
    try {
      await api.put(`/transactions/${transaction.id}`, {
        category_id: catId ? parseInt(catId) : null,
        tier: tier || null,
      })
      onSaved()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-[#111] rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{transaction.description}</p>
        <p className="text-xs text-muted-foreground">
          {transaction.date} · £{Math.abs(transaction.amount).toFixed(2)}
        </p>
      </div>
      <Select value={catId} onValueChange={setCatId}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          {categories.map(c => (
            <SelectItem key={c.id} value={c.id.toString()}>
              {c.group_name} → {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={tier} onValueChange={setTier}>
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Tier" />
        </SelectTrigger>
        <SelectContent>
          {TIERS.map(t => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" onClick={handleSave} disabled={!catId}>Save</Button>
    </div>
  )
}
