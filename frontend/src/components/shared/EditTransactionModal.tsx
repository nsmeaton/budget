import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TierBadge } from '@/components/shared/TierBadge'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { maskedCurrency } from '@/lib/utils'
import api from '@/api/client'
import type { Transaction, Category } from '@/types'

interface EditTransactionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Transaction | null
  onSaved: () => void
}

const TIERS = ['Essential', 'Optional', 'Discretionary', 'Savings', 'Transfer']
const FLOW_TYPES = ['income', 'spending', 'transfer']

export function EditTransactionModal({ open, onOpenChange, transaction, onSaved }: EditTransactionModalProps) {
  const { hideAmounts } = usePrivacy()
  const [categories, setCategories] = useState<Category[]>([])
  const fc = (amount: number) => maskedCurrency(amount, hideAmounts)
  const [categoryId, setCategoryId] = useState<string>('')
  const [tier, setTier] = useState<string>('')
  const [flowType, setFlowType] = useState<string>('')
  const [item, setItem] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data))
  }, [])

  useEffect(() => {
    if (transaction) {
      setCategoryId(transaction.category_id?.toString() || '')
      setTier(transaction.tier || '')
      setFlowType(transaction.flow_type || '')
      setItem(transaction.item || '')
    }
  }, [transaction])

  const handleSave = async () => {
    if (!transaction) return
    setSaving(true)
    try {
      await api.put(`/transactions/${transaction.id}`, {
        category_id: categoryId ? parseInt(categoryId) : null,
        tier: tier || null,
        flow_type: flowType || null,
        item: item || null,
      })
      onSaved()
      onOpenChange(false)
    } catch (err) {
      console.error('Failed to update transaction', err)
    } finally {
      setSaving(false)
    }
  }

  if (!transaction) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">{transaction.date}</p>
            <p className="font-medium">{transaction.description}</p>
            <p className="text-sm text-muted-foreground">{fc(Math.abs(transaction.amount))}</p>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
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
          </div>

          <div className="space-y-2">
            <Label>Tier</Label>
            <Select value={tier || '__none__'} onValueChange={v => setTier(v === '__none__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {TIERS.map(t => (
                  <SelectItem key={t} value={t}>
                    <TierBadge tier={t} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Flow Type</Label>
            <Select value={flowType} onValueChange={setFlowType}>
              <SelectTrigger>
                <SelectValue placeholder="Select flow type" />
              </SelectTrigger>
              <SelectContent>
                {FLOW_TYPES.map(f => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Item</Label>
            <Input value={item} onChange={e => setItem(e.target.value)} placeholder="e.g. Groceries" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
