import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  DoorOpen,
  FileDown,
  ScrollText,
  Settings,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { usePermission } from '@/hooks/useAuth'
import { isAdminOrAbove, canAccessExportsPage } from '@/utils/permissions'

const navSections = [
  {
    label: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Meetings',
    items: [
      { to: '/meetings', label: 'All Meetings', icon: CalendarDays },
      { to: '/calendar', label: 'Calendar', icon: Calendar },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/users', label: 'Users', icon: Users, adminOnly: true },
      { to: '/rooms', label: 'Rooms', icon: DoorOpen, adminOnly: true },
      { to: '/exports', label: 'Exports & Reports', icon: FileDown, exportsPage: true },
      { to: '/audit', label: 'Audit Log', icon: ScrollText, adminOnly: true },
    ],
  },
  {
    label: 'Account',
    items: [{ to: '/settings', label: 'Settings', icon: Settings }],
  },
]

export default function Sidebar({ collapsed, onToggle }) {
  const { user } = usePermission()
  const showAdmin = isAdminOrAbove(user)
  const showExports = canAccessExportsPage(user)

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col bg-sidebar text-white transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      <div className="border-b border-white/10 px-4 py-5">
        {!collapsed && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-200">
              Government of Pakistan
            </p>
            <h1 className="mt-1 text-lg font-bold leading-tight">Meeting Planner</h1>
          </>
        )}
        {collapsed && (
          <div className="flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-sm font-bold">
              MP
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navSections.map((section) => {
          const items = section.items.filter((item) => {
            if (item.adminOnly) return showAdmin
            if (item.exportsPage) return showExports
            return true
          })
          if (items.length === 0) return null
          return (
            <div key={section.label} className="mb-5">
              {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-primary-300/80">
                  {section.label}
                </p>
              )}
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-sidebar-active text-white'
                            : 'text-primary-100 hover:bg-sidebar-hover hover:text-white',
                          collapsed && 'justify-center px-2',
                        )
                      }
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={onToggle}
        className="m-3 flex items-center justify-center rounded-lg border border-white/10 py-2 text-primary-200 transition-colors hover:bg-sidebar-hover hover:text-white"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  )
}
