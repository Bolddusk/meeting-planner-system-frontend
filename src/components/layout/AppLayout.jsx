import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { cn } from '@/utils/cn'

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/meetings': 'Meetings',
  '/calendar': 'Calendar',
  '/calendar': 'Calendar',
  '/users': 'User Management',
  '/rooms': 'Rooms',
  '/exports': 'Exports & Reports',
  '/audit': 'Audit Log',
  '/settings': 'Settings',
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const title =
    pageTitles[location.pathname] ||
    (location.pathname.startsWith('/meetings/') ? 'Meeting Detail' : 'Meeting Planner Admin')

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div
        className={cn(
          'flex min-h-screen flex-col transition-all duration-300',
          collapsed ? 'ml-[72px]' : 'ml-64',
        )}
      >
        <Topbar title={title} sidebarCollapsed={collapsed} />
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
