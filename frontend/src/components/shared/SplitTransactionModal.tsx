import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import api from '@/api/client'
import type { Transaction, Category } from '@/types'

interface SplitTransactionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Transaction | null
  onSaved: () => void
}

interface SplitChild {
  amount: string
  description: string
  category_id: string
  tier: string
}

const TIERS = ['Essential', 'Optional', 'Discretionary', 'Savings', 'Transfer']

export function SplitTransactionModal({ open, onOpenChange, transaction, onSaved }: SplitTransactionModalProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [children, setChildren] = useState<SplitChild[]>([
    { amount: '', description: '', category_id: '', tier: '' },
    { amount: '', description: '', category_id: '', tier: '' },
  ])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data))
  }, [])

  useEffect(() => {
    if (transaction) {
      setChildren([
        { amount: '', description: transaction.description, category_id: '', tier: '' },
        { amount: '', description: '', category_id: '', tier: '' },
      ])
    }
  }, [transaction])

  const addChild = () => {
    setChildren([...children, { amount: '', description: '', category_id: '', tier: '' }])
  }

  const removeChild = (idx: number) => {
    if (children.length <= 2) return
    setChildren(children.filter((_, i) => i !== idx))
  }

  const updateChild = (idx: number, field: keyof SplitChild, value: string) => {
    const updated = [...children]
    updated[idx] = { ...updated[idx], [field]: value }
    setChildren(updated)
  }

  const totalAllocated = children.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0)
  const remaining = transaction ? Math.abs(transaction.amount) - totalAllocated : 0

  const handleSave = async () => {
    if (!transaction) return
    setSaving(true)
    try {
      await api.post(`/transactions/${transaction.id}/split`, {
        children: children.map(c => ({
          amount: parseFloat(c.amount) || 0,
          description: c.description || null,
          category_id: c.category_id ? parseInt(c.category_id) : null,
          tier: c.tier || null,
        })),
      })
      onSaved()
      onOpenChange(false)
    } catch (err) {
      console.error('Failed to split', err)
    } finally {
      setSaving(false)
    }
  }

  if (!transaction) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Split Transaction</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {transaction.description} — £{Math.abs(transaction.amount).toFixed(2)}
          </p>
          <p className="text-sm">
            Allocated: £{totalAllocated.toFixed(2)} | Remaining:{' '}
            <span className={remaining < 0 ? 'text-red-400' : remaining > 0.01 ? 'text-amber-400' : 'text-green-400'}>
              £{remaining.toFixed(2)}
            </span>
          </p>
        </div>

        <div className="space-y-3">
          {children.map((child, idx) => (
            <div key={idx} className="flex gap-2 items-start p-3 rounded-lg bg-[#111] border border-border/50">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    value={child.amount}
                    onChange={e => updateChild(idx, 'amount', e.target.value)}
                    className="w-28"
                  />
                  <Input
                    placeholder="Description"
                    value={child.description}
                    onChange={e => updateChild(idx, 'description', e.target.value)}
                    className="flex-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={child.category_id} onValueChange={v => updateChild(idx, 'category_id', v)}>
                    <SelectTrigger className="flex-1">
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
                  <Select value={child.tier} onValueChange={v => updateChild(idx, 'tier', v)}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Tier" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIERS.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeChild(idx)} disabled={children.length <= 2}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={addChild} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Add Split
        </Button>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || Math.abs(remaining) > 0.01}>
            {saving ? 'Splitting...' : 'Split Transaction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
