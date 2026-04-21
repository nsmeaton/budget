import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, List, Upload, Tag, Zap, CreditCard, LogOut, Calendar,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const NAV_SECTIONS = [
  {
    label: 'OVERVIEW',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/month', icon: Calendar, label: 'Month Overview' },
      { to: '/trends', icon: TrendingUp, label: 'Trends' },
    ],
  },
  {
    label: 'TRANSACTIONS',
    items: [
      { to: '/transactions', icon: List, label: 'Transactions' },
      { to: '/import', icon: Upload, label: 'Import' },
    ],
  },
  {
    label: 'MANAGE',
    items: [
      { to: '/categories', icon: Tag, label: 'Categories' },
      { to: '/rules', icon: Zap, label: 'Rules' },
      { to: '/accounts', icon: CreditCard, label: 'Accounts' },
    ],
  },
]

export default function Sidebar() {
  const { logout, username } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[200px] bg-[#111] border-r border-border/50 flex flex-col z-40">
      <div className="p-4 border-b border-border/50">
        <h1 className="text-lg font-bold tracking-tight">💰 Budget</h1>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-2 px-2">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-primary/15 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-border/50">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-muted-foreground truncate">{username}</span>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
