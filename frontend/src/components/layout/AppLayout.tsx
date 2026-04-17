import Sidebar from './Sidebar'
import DateRangePicker from './DateRangePicker'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <div className="ml-[200px]">
        <header className="sticky top-0 z-30 flex items-center justify-end px-6 py-3 bg-[#0a0a0a]/80 backdrop-blur-sm border-b border-border/30">
          <DateRangePicker />
        </header>
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
