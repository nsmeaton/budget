import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { TierBadge } from '@/components/shared/TierBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus } from 'lucide-react'
import { maskedCurrency } from '@/lib/utils'
import { usePrivacy } from '@/contexts/PrivacyContext'
import api from '@/api/client'
import type { CategoryGroup, Category } from '@/types'

const TIERS = ['Essential', 'Optional', 'Discretionary', 'Savings', 'Transfer']

export default function CategoriesPage() {
  const { hideAmounts } = usePrivacy()
  const [groups, setGroups] = useState<CategoryGroup[]>([])
  const fc = (amount: number) => maskedCurrency(amount, hideAmounts)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [editCat, setEditCat] = useState<Category | null>(null)
  const [deleteCat, setDeleteCat] = useState<Category | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formGroupId, setFormGroupId] = useState('')
  const [formTier, setFormTier] = useState('')

  const fetchGroups = async () => {
    setLoading(true)
    try {
      const r = await api.get('/categories/groups')
      setGroups(r.data)
      // Expand all by default
      setExpanded(new Set(r.data.map((g: CategoryGroup) => g.id)))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGroups() }, [])

  const toggleGroup = (id: number) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  const totalCategories = groups.reduce((s, g) => s + g.categories.length, 0)

  const handleAdd = async () => {
    try {
      await api.post('/categories', {
        name: formName,
        group_id: parseInt(formGroupId),
        default_tier: formTier || null,
      })
      setShowAdd(false)
      setFormName('')
      setFormGroupId('')
      setFormTier('')
      fetchGroups()
    } catch (err) {
      console.error(err)
    }
  }

  const handleEdit = async () => {
    if (!editCat) return
    try {
      await api.put(`/categories/${editCat.id}`, {
        name: formName,
        group_id: parseInt(formGroupId),
        default_tier: formTier || null,
      })
      setEditCat(null)
      fetchGroups()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async () => {
    if (!deleteCat) return
    try {
      await api.delete(`/categories/${deleteCat.id}`)
      fetchGroups()
    } catch (err) {
      console.error(err)
    }
  }

  const openEdit = (cat: Category) => {
    setEditCat(cat)
    setFormName(cat.name)
    setFormGroupId(cat.group_id.toString())
    setFormTier(cat.default_tier || '')
  }

  const openAdd = () => {
    setShowAdd(true)
    setFormName('')
    setFormGroupId(groups[0]?.id.toString() || '')
    setFormTier('')
  }

  if (loading) return <div className="text-muted-foreground">Loading categories...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground">
            {totalCategories} categories across {groups.length} groups
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" /> Add Category
        </Button>
      </div>

      <Card className="bg-[#1a1a1a] border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Default Tier</TableHead>
                <TableHead className="text-right">Transactions</TableHead>
                <TableHead className="text-right">Total Spend</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map(group => (
                <>
                  <TableRow
                    key={`group-${group.id}`}
                    className="cursor-pointer bg-muted/20 hover:bg-muted/40"
                    onClick={() => toggleGroup(group.id)}
                  >
                    <TableCell className="font-semibold">
                      <div className="flex items-center gap-2">
                        {expanded.has(group.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        {group.name}
                        <span className="text-xs text-muted-foreground font-normal">
                          ({group.categories.length})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right text-muted-foreground">{group.transaction_count}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fc(group.total_spend)}</TableCell>
                    <TableCell />
                  </TableRow>
                  {expanded.has(group.id) &&
                    group.categories.map(cat => (
                      <TableRow key={`cat-${cat.id}`}>
                        <TableCell className="pl-10">{cat.name}</TableCell>
                        <TableCell><TierBadge tier={cat.default_tier} /></TableCell>
                        <TableCell className="text-right">{cat.transaction_count}</TableCell>
                        <TableCell className="text-right">{fc(cat.total_spend)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEdit(cat)}
                              className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteCat(cat)}
                              className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd || !!editCat} onOpenChange={() => { setShowAdd(false); setEditCat(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editCat ? 'Edit Category' : 'Add Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Group</Label>
              <Select value={formGroupId} onValueChange={setFormGroupId}>
                <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                <SelectContent>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Default Tier</Label>
              <Select value={formTier} onValueChange={setFormTier}>
                <SelectTrigger><SelectValue placeholder="Select tier" /></SelectTrigger>
                <SelectContent>
                  {TIERS.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditCat(null) }}>Cancel</Button>
            <Button onClick={editCat ? handleEdit : handleAdd} disabled={!formName || !formGroupId}>
              {editCat ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteCat}
        onOpenChange={() => setDeleteCat(null)}
        title="Delete Category"
        description={`Delete "${deleteCat?.name}"? Transactions using this category will become uncategorised.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        destructive
      />
    </div>
  )
}
