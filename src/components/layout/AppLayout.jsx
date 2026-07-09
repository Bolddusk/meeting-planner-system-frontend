import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import { isUserRole } from '@/utils/permissions'

function getPageTitle(pathname, isUser) {
  const titles = {
    '/dashboard': 'Dashboard',
    '/meetings': isUser ? 'My Meetings' : 'Meetings',
    '/calendar': 'Calendar',
    '/users': 'User Management',
    '/rooms': 'Rooms',
    '/exports': 'Exports & Reports',
    '/audit': 'Audit Log',
    '/settings': 'Settings',
    '/notifications': 'Notifications',
  }

  if (titles[pathname]) return titles[pathname]
  if (pathname.startsWith('/meetings/')) return 'Meeting Detail'
  return isUser ? 'Meeting Planner' : 'Meeting Planner Admin'
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const { user } = useAuth()
  const isUser = isUserRole(user)
  const title = getPageTitle(location.pathname, isUser)

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
        <main className="min-w-0 flex-1 overflow-x-hidden p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
