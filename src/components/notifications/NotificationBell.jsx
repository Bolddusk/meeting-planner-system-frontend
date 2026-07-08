import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/api/notifications'
import { getApiErrorMessage } from '@/api/axios'
import { getNotificationMeta } from '@/utils/notificationTypes'
import { formatRelativeTime } from '@/utils/relativeTime'
import { cn } from '@/utils/cn'

const POLL_INTERVAL_MS = 60_000

export default function NotificationBell() {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await getNotifications({ limit: 5, unreadOnly: true })
      setNotifications(res.data ?? [])
      setUnreadCount(res.meta?.unreadCount ?? 0)
      setError('')
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggle = async () => {
    const next = !open
    setOpen(next)
    if (next) {
      setLoading(true)
      await fetchNotifications()
      setLoading(false)
    }
  }

  const handleRead = async (notification) => {
    try {
      if (!notification.is_read) {
        await markNotificationRead(notification.id)
      }
      await fetchNotifications()
      setOpen(false)
      if (notification.meeting_id) {
        navigate(`/meetings/${notification.meeting_id}`)
      }
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  const handleMarkAllRead = async () => {
    try {
      setLoading(true)
      await markAllNotificationsRead()
      await fetchNotifications()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-xs font-medium text-primary-700 hover:text-primary-800 disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {error && (
            <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-700" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No unread notifications</p>
            ) : (
              notifications.map((n) => {
                const meta = getNotificationMeta(n.type)
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleRead(n)}
                    className={cn(
                      'flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-50',
                      !n.is_read && 'bg-primary-50/40',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base',
                        meta.bg,
                      )}
                    >
                      {meta.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{n.title}</p>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>
                      )}
                      <p className="mt-1 text-xs text-slate-400">
                        {formatRelativeTime(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary-600" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
