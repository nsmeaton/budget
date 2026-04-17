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
import { Pencil, Trash2, Plus, Play, Search } from 'lucide-react'
import api from '@/api/client'
import type { Rule, Category } from '@/types'

const MATCH_TYPES = ['contains', 'starts_with', 'exact']
const TIERS = ['Essential', 'Optional', 'Discretionary', 'Savings', 'Transfer']

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editRule, setEditRule] = useState<Rule | null>(null)
  const [deleteRule, setDeleteRule] = useState<Rule | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  // Form
  const [formPattern, setFormPattern] = useState('')
  const [formMatchType, setFormMatchType] = useState('contains')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formTier, setFormTier] = useState('')

  const fetchRules = async () => {
    setLoading(true)
    try {
      const r = await api.get('/rules')
      setRules(r.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRules()
    api.get('/categories').then(r => setCategories(r.data))
  }, [])

  const filteredRules = rules.filter(r =>
    r.match_pattern.toLowerCase().includes(search.toLowerCase()) ||
    r.category_name.toLowerCase().includes(search.toLowerCase())
  )

  const handleAdd = async () => {
    try {
      await api.post('/rules', {
        match_pattern: formPattern,
        match_type: formMatchType,
        category_id: parseInt(formCategoryId),
        default_tier: formTier || null,
      })
      setShowAdd(false)
      resetForm()
      fetchRules()
    } catch (err) {
      console.error(err)
    }
  }

  const handleEdit = async () => {
    if (!editRule) return
    try {
      await api.put(`/rules/${editRule.id}`, {
        match_pattern: formPattern,
        match_type: formMatchType,
        category_id: parseInt(formCategoryId),
        default_tier: formTier || null,
      })
      setEditRule(null)
      resetForm()
      fetchRules()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async () => {
    if (!deleteRule) return
    try {
      await api.delete(`/rules/${deleteRule.id}`)
      fetchRules()
    } catch (err) {
      console.error(err)
    }
  }

  const resetForm = () => {
    setFormPattern('')
    setFormMatchType('contains')
    setFormCategoryId('')
    setFormTier('')
  }

  const openEdit = (rule: Rule) => {
    setEditRule(rule)
    setFormPattern(rule.match_pattern)
    setFormMatchType(rule.match_type)
    setFormCategoryId(rule.category_id.toString())
    setFormTier(rule.default_tier || '')
  }

  const openAdd = () => {
    setShowAdd(true)
    resetForm()
  }

  const handleTest = async (rule: Rule) => {
    try {
      const r = await api.get('/transactions', {
        params: { search: rule.match_pattern, page_size: 5 },
      })
      const count = r.data.total
      alert(`Pattern "${rule.match_pattern}" matches ${count} transaction${count !== 1 ? 's' : ''}`)
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return <div className="text-muted-foreground">Loading rules...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Auto-Categorisation Rules</h1>
          <p className="text-sm text-muted-foreground">
            {rules.length} rules · Applied during import
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search rules..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 w-[200px]"
            />
          </div>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add Rule
          </Button>
        </div>
      </div>

      <Card className="bg-[#1a1a1a] border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Match Pattern</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Matched</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No rules found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRules.map(rule => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <span className="font-mono text-sm bg-muted/50 px-2 py-0.5 rounded">
                        {rule.match_type} "{rule.match_pattern}"
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{rule.category_name}</TableCell>
                    <TableCell><TierBadge tier={rule.default_tier} /></TableCell>
                    <TableCell className="text-right text-muted-foreground">{rule.matched_count}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleTest(rule)}
                          className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                          title="Test"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => openEdit(rule)}
                          className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteRule(rule)}
                          className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd || !!editRule} onOpenChange={() => { setShowAdd(false); setEditRule(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editRule ? 'Edit Rule' : 'Add Rule'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Match Pattern</Label>
              <Input
                value={formPattern}
                onChange={e => setFormPattern(e.target.value)}
                placeholder="e.g. TESCO"
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label>Match Type</Label>
              <Select value={formMatchType} onValueChange={setFormMatchType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MATCH_TYPES.map(mt => (
                    <SelectItem key={mt} value={mt}>{mt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.group_name} → {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Default Tier</Label>
              <Select value={formTier} onValueChange={setFormTier}>
                <SelectTrigger><SelectValue placeholder="Select tier (optional)" /></SelectTrigger>
                <SelectContent>
                  {TIERS.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditRule(null) }}>Cancel</Button>
            <Button onClick={editRule ? handleEdit : handleAdd} disabled={!formPattern || !formCategoryId}>
              {editRule ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteRule}
        onOpenChange={() => setDeleteRule(null)}
        title="Delete Rule"
        description={`Delete rule "${deleteRule?.match_pattern}"?`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        destructive
      />
    </div>
  )
}
