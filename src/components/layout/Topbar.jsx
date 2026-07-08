import { useState, useRef, useEffect } from 'react'
import { ChevronDown, LogOut, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/utils/cn'
import NotificationBell from '@/components/notifications/NotificationBell'

export default function Topbar({ title, sidebarCollapsed }) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8 shadow-sm transition-all',
      )}
    >
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>

      <div className="flex items-center gap-4">
        <NotificationBell />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-700 text-sm font-semibold text-white">
              {user?.full_name?.charAt(0) ?? 'U'}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold text-slate-800">{user?.full_name}</p>
              <p className="text-xs text-slate-500">{user?.role?.name}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">{user?.full_name}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setMenuOpen(false)}
              >
                <User className="h-4 w-4" />
                Profile
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                onClick={() => {
                  setMenuOpen(false)
                  logout()
                }}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
