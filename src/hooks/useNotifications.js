import { useCallback, useEffect, useState } from 'react'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/api/notifications'
import { getApiErrorMessage } from '@/api/axios'

export const NOTIFICATION_POLL_MS = 60_000

export function useNotifications({ enabled = true, pollMs = NOTIFICATION_POLL_MS } = {}) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(
    async (params = { limit: 10, unreadOnly: true }) => {
      if (!enabled) return null
      try {
        const res = await getNotifications(params)
        const list = res.data ?? []
        setNotifications(list)
        setUnreadCount(res.meta?.unreadCount ?? list.filter((n) => !n.is_read).length)
        setError('')
        return res
      } catch (err) {
        setError(getApiErrorMessage(err))
        return null
      }
    },
    [enabled],
  )

  const refreshUnread = useCallback(
    () => refresh({ limit: 10, unreadOnly: true }),
    [refresh],
  )

  const refreshRecent = useCallback(
    () => refresh({ limit: 10, unreadOnly: false }),
    [refresh],
  )

  useEffect(() => {
    if (!enabled) return undefined

    refreshUnread()

    const interval = setInterval(refreshUnread, pollMs)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshUnread()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, pollMs, refreshUnread])

  const markRead = useCallback(
    async (id) => {
      await markNotificationRead(id)
      await refreshUnread()
    },
    [refreshUnread],
  )

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead()
    await refreshUnread()
  }, [refreshUnread])

  return {
    notifications,
    unreadCount,
    loading,
    error,
    setLoading,
    refresh,
    refreshUnread,
    refreshRecent,
    markRead,
    markAllRead,
  }
}
