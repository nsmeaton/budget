import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Pencil, Trash2, Plus, Upload, List } from 'lucide-react'
import { formatCurrency, maskedCurrency, formatDate } from '@/lib/utils'
import { usePrivacy } from '@/contexts/PrivacyContext'
import api from '@/api/client'
import type { Account } from '@/types'

const BANK_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500',
  'bg-red-500', 'bg-teal-500', 'bg-pink-500', 'bg-indigo-500',
]

function getBankColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return BANK_COLORS[Math.abs(hash) % BANK_COLORS.length]
}

function getBankInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function AccountsPage() {
  const navigate = useNavigate()
  const { hideAmounts } = usePrivacy()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [editAcct, setEditAcct] = useState<Account | null>(null)
  const [deleteAcct, setDeleteAcct] = useState<Account | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const [formBankName, setFormBankName] = useState('')
  const [formAccountName, setFormAccountName] = useState('')

  const fetchAccounts = async () => {
    setLoading(true)
    try {
      const r = await api.get('/accounts')
      setAccounts(r.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAccounts() }, [])

  const totalTxCount = accounts.reduce((s, a) => s + a.transaction_count, 0)

  const handleAdd = async () => {
    try {
      await api.post('/accounts', { bank_name: formBankName, account_name: formAccountName })
      setShowAdd(false)
      setFormBankName('')
      setFormAccountName('')
      fetchAccounts()
    } catch (err) {
      console.error(err)
    }
  }

  const handleEdit = async () => {
    if (!editAcct) return
    try {
      await api.put(`/accounts/${editAcct.id}`, {
        bank_name: formBankName,
        account_name: formAccountName,
      })
      setEditAcct(null)
      fetchAccounts()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async () => {
    if (!deleteAcct) return
    try {
      await api.delete(`/accounts/${deleteAcct.id}`)
      fetchAccounts()
    } catch (err) {
      console.error(err)
    }
  }

  const openEdit = (acct: Account) => {
    setEditAcct(acct)
    setFormBankName(acct.bank_name)
    setFormAccountName(acct.account_name)
  }

  const openAdd = () => {
    setShowAdd(true)
    setFormBankName('')
    setFormAccountName('')
  }

  if (loading) return <div className="text-muted-foreground">Loading accounts...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bank Accounts</h1>
          <p className="text-sm text-muted-foreground">
            {accounts.length} accounts · {totalTxCount.toLocaleString()} total transactions
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" /> Add Account
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map(acct => (
          <Card key={acct.id} className="bg-[#1a1a1a] border-border/50">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full ${getBankColor(acct.bank_name)} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                  {getBankInitials(acct.bank_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{acct.bank_name} — {acct.account_name}</h3>
                      <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                        <p>Mapping: {acct.bank_profile ? 'Configured' : 'Not set'}</p>
                        <p>Last import: {acct.last_import_date ? formatDate(acct.last_import_date) : 'Never'}</p>
                        <p>Transactions: {acct.transaction_count.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">
                        {acct.current_balance != null
                          ? maskedCurrency(acct.current_balance, hideAmounts)
                          : '—'}
                      </p>
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={() => openEdit(acct)}
                          className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteAcct(acct)}
                          className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={() => navigate('/import')}>
                      <Upload className="h-3.5 w-3.5 mr-1" /> Import
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/transactions?account=${acct.id}`)}>
                      <List className="h-3.5 w-3.5 mr-1" /> View Transactions
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {accounts.length === 0 && (
        <Card className="bg-[#1a1a1a] border-border/50">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No accounts yet. Add one to get started.</p>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd || !!editAcct} onOpenChange={() => { setShowAdd(false); setEditAcct(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editAcct ? 'Edit Account' : 'Add Account'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Bank Name</Label>
              <Input value={formBankName} onChange={e => setFormBankName(e.target.value)} placeholder="e.g. HSBC" />
            </div>
            <div className="space-y-1">
              <Label>Account Name</Label>
              <Input value={formAccountName} onChange={e => setFormAccountName(e.target.value)} placeholder="e.g. Current Account" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditAcct(null) }}>Cancel</Button>
            <Button onClick={editAcct ? handleEdit : handleAdd} disabled={!formBankName || !formAccountName}>
              {editAcct ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteAcct}
        onOpenChange={() => setDeleteAcct(null)}
        title="Delete Account"
        description={`Delete "${deleteAcct?.bank_name} — ${deleteAcct?.account_name}"? All transactions in this account will be deleted.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        destructive
      />
    </div>
  )
}
