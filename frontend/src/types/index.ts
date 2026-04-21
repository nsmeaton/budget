// ── Types matching backend schemas ──

export interface Account {
  id: number
  bank_name: string
  account_name: string
  created_at: string
  bank_profile: BankProfile | null
  transaction_count: number
  last_import_date: string | null
  current_balance: number | null
}

export interface BankProfile {
  id: number
  account_id: number
  date_column: number
  description_column: number
  amount_column: number | null
  debit_column: number | null
  credit_column: number | null
  balance_column: number | null
  date_format: string
  has_header: boolean
}

export interface CategoryGroup {
  id: number
  name: string
  categories: Category[]
  transaction_count: number
  total_spend: number
}

export interface Category {
  id: number
  group_id: number
  group_name: string
  name: string
  default_tier: string | null
  transaction_count: number
  total_spend: number
  created_at: string
}

export interface Rule {
  id: number
  match_pattern: string
  match_type: string
  category_id: number
  category_name: string
  default_tier: string | null
  matched_count: number
  created_at: string
}

export interface Transaction {
  id: number
  account_id: number
  account_name: string
  bank_name: string
  parent_id: number | null
  date: string
  description: string
  amount: number
  balance: number | null
  direction: string
  flow_type: string | null
  income_type: string | null
  tier: string | null
  category_id: number | null
  category_name: string
  item: string | null
  is_split: boolean
  rule_id: number | null
  children: Transaction[]
  created_at: string
  updated_at: string
}

export interface TransactionListResponse {
  items: Transaction[]
  total: number
  page: number
  page_size: number
}

export interface MonthlyBreakdown {
  month: string
  income_salary: number
  income_bonus: number
  income_rsu: number
  income_investments: number
  income_total: number
  spending_essential: number
  spending_optional: number
  spending_discretionary: number
  spending_total: number
  savings: number
  transfers: number
  net: number
}

export interface DashboardKPIs {
  total_income: number
  total_spending: number
  avg_monthly_essential: number
  avg_monthly_essential_optional: number
  total_savings: number
  savings_rate: number
  income_change_pct: number | null
}

export interface DashboardResponse {
  kpis: DashboardKPIs
  monthly_breakdown: MonthlyBreakdown[]
  date_from: string
  date_to: string
}

export interface CategoryTrend {
  category_name: string
  data: { month: string; amount: number }[]
}

export interface TierTrend {
  tier: string
  data: { month: string; amount: number }[]
}

export interface TopCategory {
  category_name: string
  total: number
  percentage: number
}

export interface TrendsResponse {
  category_trends: CategoryTrend[]
  tier_trends: TierTrend[]
  income_vs_spending: { month: string; income: number; spending: number; savings: number }[]
  top_categories: TopCategory[]
}

export interface CSVPreviewResponse {
  headers: string[]
  rows: string[][]
  total_rows: number
}

export interface ImportResult {
  total_rows: number
  imported: number
  auto_categorised: number
  needs_review: number
  duplicates_flagged: number
  duplicate_candidates: DuplicateCandidate[]
  uncategorised_ids: number[]
}

export interface DuplicateCandidate {
  csv_row: number
  date: string
  description: string
  amount: number
  existing_id: number
  existing_date: string
  existing_description: string
  existing_amount: number
}

export type Tier = 'Essential' | 'Optional' | 'Discretionary' | 'Savings' | 'Transfer'
export type FlowType = 'income' | 'spending' | 'transfer'
