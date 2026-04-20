import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-screen overflow-hidden" style={{ gridTemplateColumns: 'var(--sidebar-w) 1fr', background: 'var(--bg-0)' }}>
      <Sidebar />
      <div className="flex min-w-0 flex-col overflow-hidden">
        <Header />
        <main className="fade-in relative flex-1 overflow-y-auto px-8 pb-20 pt-7">
          {children}
        </main>
      </div>
    </div>
  )
}
