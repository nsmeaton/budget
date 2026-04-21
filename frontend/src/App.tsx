import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { DateRangeProvider } from './contexts/DateRangeContext'
import { PrivacyProvider } from './contexts/PrivacyContext'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import TrendsPage from './pages/TrendsPage'
import TransactionsPage from './pages/TransactionsPage'
import ImportPage from './pages/ImportPage'
import CategoriesPage from './pages/CategoriesPage'
import RulesPage from './pages/RulesPage'
import AccountsPage from './pages/AccountsPage'
import MonthOverviewPage from './pages/MonthOverviewPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-muted-foreground">Loading...</div>
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DateRangeProvider>
              <PrivacyProvider>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/month" element={<MonthOverviewPage />} />
                    <Route path="/trends" element={<TrendsPage />} />
                    <Route path="/transactions" element={<TransactionsPage />} />
                    <Route path="/import" element={<ImportPage />} />
                    <Route path="/categories" element={<CategoriesPage />} />
                    <Route path="/rules" element={<RulesPage />} />
                    <Route path="/accounts" element={<AccountsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AppLayout>
              </PrivacyProvider>
            </DateRangeProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
