import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import PageHero from '@/components/ui/PageHero'
import Card, { CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '@/api/notifications'
import { getApiErrorMessage } from '@/api/axios'
import { getNotificationMeta } from '@/utils/notificationTypes'
import { formatRelativeTime } from '@/utils/relativeTime'
import { cn } from '@/utils/cn'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'REMINDER', label: 'Reminders' },
  { id: 'unread', label: 'Unread' },
]

export default function Notifications() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getNotifications({ page: 1, limit: 50 })
      setItems(res.data ?? [])
      setUnreadCount(res.meta?.unreadCount ?? (res.data ?? []).filter((n) => !n.is_read).length)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const filteredItems = useMemo(() => {
    if (filter === 'REMINDER') return items.filter((n) => n.type === 'REMINDER')
    if (filter === 'unread') return items.filter((n) => !n.is_read)
    return items
  }, [items, filter])

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      await loadNotifications()
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  const handleOpen = async (notification) => {
    try {
      if (!notification.is_read) {
        await markNotificationRead(notification.id)
        setItems((prev) =>
          prev.map((item) =>
            item.id === notification.id ? { ...item, is_read: true } : item,
          ),
        )
        setUnreadCount((count) => Math.max(0, count - 1))
      }
      if (notification.meeting_id) {
        navigate(`/meetings/${notification.meeting_id}`)
      }
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="INBOX"
        title="Notifications"
        description="Meeting reminders, invites, and updates appear here automatically."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                filter === item.id
                  ? 'bg-primary-700 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="secondary" onClick={handleMarkAllRead}>
            Mark all read ({unreadCount})
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-700" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <Bell className="h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-500">No notifications to show.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredItems.map((notification) => {
                const meta = getNotificationMeta(notification.type)
                const isReminder = notification.type === 'REMINDER'

                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleOpen(notification)}
                    className={cn(
                      'flex w-full gap-4 px-6 py-4 text-left transition-colors hover:bg-slate-50',
                      !notification.is_read && 'bg-primary-50/30',
                      isReminder && !notification.is_read && 'border-l-4 border-l-amber-400',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg',
                        meta.bg,
                      )}
                    >
                      {meta.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-sm text-slate-900',
                          !notification.is_read && 'font-semibold',
                        )}
                      >
                        {notification.title}
                      </p>
                      {notification.body && (
                        <p className="mt-1 text-sm text-slate-600">{notification.body}</p>
                      )}
                      {notification.meeting?.title && (
                        <p className="mt-1 text-xs text-slate-500">
                          {notification.meeting.title}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-slate-400">
                        {formatRelativeTime(notification.created_at)}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary-600" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
