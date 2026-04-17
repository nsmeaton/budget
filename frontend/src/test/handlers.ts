import { http, HttpResponse } from 'msw'

const BASE = '/api'

export const handlers = [
  // Auth status
  http.get(`${BASE}/auth/status`, () => {
    return HttpResponse.json({ setup_complete: true })
  }),

  // Login
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { username: string; password: string }
    if (body.username === 'admin' && body.password === 'password') {
      return HttpResponse.json({ token: 'fake-jwt-token', username: 'admin' })
    }
    return HttpResponse.json({ detail: 'Invalid credentials' }, { status: 401 })
  }),

  // Setup
  http.post(`${BASE}/auth/setup`, async ({ request }) => {
    const body = (await request.json()) as { username: string; password: string }
    return HttpResponse.json({ token: 'fake-jwt-token', username: body.username })
  }),

  // Dashboard
  http.get(`${BASE}/dashboard`, () => {
    return HttpResponse.json({
      kpis: {
        total_income: 60000,
        total_spending: 35000,
        avg_monthly_essential: 2500,
        total_savings: 15000,
        savings_rate: 25.0,
        income_change_pct: 5.2,
      },
      monthly_breakdown: [
        {
          month: '2025-01',
          income_salary: 4500,
          income_bonus: 0,
          income_rsu: 0,
          income_investments: 0,
          income_total: 4500,
          spending_essential: 2000,
          spending_optional: 500,
          spending_discretionary: 300,
          spending_total: 2800,
          savings: 1200,
          transfers: 500,
          net: 1700,
        },
        {
          month: '2025-02',
          income_salary: 4500,
          income_bonus: 1000,
          income_rsu: 0,
          income_investments: 0,
          income_total: 5500,
          spending_essential: 2200,
          spending_optional: 600,
          spending_discretionary: 400,
          spending_total: 3200,
          savings: 1500,
          transfers: 300,
          net: 2300,
        },
      ],
      date_from: '2025-01-01',
      date_to: '2025-12-31',
    })
  }),

  // Transactions list
  http.get(`${BASE}/transactions`, ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    return HttpResponse.json({
      items: [
        {
          id: 1,
          account_id: 1,
          account_name: 'Current Account',
          bank_name: 'HSBC',
          parent_id: null,
          date: '2025-01-15',
          description: 'Tesco Groceries',
          amount: -85.5,
          balance: 1500.0,
          direction: 'out',
          flow_type: 'spending',
          income_type: null,
          tier: 'Essential',
          category_id: 1,
          category_name: 'Groceries',
          item: null,
          is_split: false,
          rule_id: 1,
          children: [],
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T10:00:00Z',
        },
        {
          id: 2,
          account_id: 1,
          account_name: 'Current Account',
          bank_name: 'HSBC',
          parent_id: null,
          date: '2025-01-16',
          description: 'Salary',
          amount: 4500.0,
          balance: 6000.0,
          direction: 'in',
          flow_type: 'income',
          income_type: 'salary',
          tier: null,
          category_id: 2,
          category_name: 'Income',
          item: null,
          is_split: false,
          rule_id: null,
          children: [],
          created_at: '2025-01-16T10:00:00Z',
          updated_at: '2025-01-16T10:00:00Z',
        },
        {
          id: 3,
          account_id: 1,
          account_name: 'Current Account',
          bank_name: 'HSBC',
          parent_id: null,
          date: '2025-01-17',
          description: 'Netflix',
          amount: -15.99,
          balance: 5984.01,
          direction: 'out',
          flow_type: 'spending',
          income_type: null,
          tier: 'Discretionary',
          category_id: 3,
          category_name: 'Entertainment',
          item: null,
          is_split: false,
          rule_id: 2,
          children: [],
          created_at: '2025-01-17T10:00:00Z',
          updated_at: '2025-01-17T10:00:00Z',
        },
      ],
      total: 3,
      page,
      page_size: 50,
    })
  }),

  // Accounts
  http.get(`${BASE}/accounts`, () => {
    return HttpResponse.json([
      {
        id: 1,
        bank_name: 'HSBC',
        account_name: 'Current Account',
        created_at: '2025-01-01T00:00:00Z',
        bank_profile: null,
        transaction_count: 150,
        last_import_date: '2025-01-20',
        current_balance: 5984.01,
      },
    ])
  }),

  // Categories
  http.get(`${BASE}/categories`, () => {
    return HttpResponse.json([
      { id: 1, group_id: 1, group_name: 'Living', name: 'Groceries', default_tier: 'Essential', transaction_count: 50, total_spend: 4250, created_at: '2025-01-01T00:00:00Z' },
      { id: 2, group_id: 2, group_name: 'Income', name: 'Income', default_tier: null, transaction_count: 12, total_spend: 0, created_at: '2025-01-01T00:00:00Z' },
      { id: 3, group_id: 3, group_name: 'Lifestyle', name: 'Entertainment', default_tier: 'Discretionary', transaction_count: 20, total_spend: 320, created_at: '2025-01-01T00:00:00Z' },
    ])
  }),

  // Delete transaction
  http.delete(`${BASE}/transactions/:id`, () => {
    return HttpResponse.json({ ok: true })
  }),

  // Bulk categorise
  http.post(`${BASE}/transactions/bulk-categorise`, () => {
    return HttpResponse.json({ updated: 0 })
  }),
]
