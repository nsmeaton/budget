import Sidebar from './Sidebar'
import DateRangePicker from './DateRangePicker'
import { Eye, EyeOff } from 'lucide-react'
import { usePrivacy } from '@/contexts/PrivacyContext'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { hideAmounts, toggleHideAmounts } = usePrivacy()

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <div className="ml-[200px]">
        <header className="sticky top-0 z-30 flex items-center justify-end gap-3 px-6 py-3 bg-[#0a0a0a]/80 backdrop-blur-sm border-b border-border/30">
          <button
            onClick={toggleHideAmounts}
            className={`p-2 rounded-md transition-colors ${
              hideAmounts
                ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
            title={hideAmounts ? 'Show amounts' : 'Hide amounts'}
          >
            {hideAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <DateRangePicker />
        </header>
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
