import { useCallback, useEffect, useState } from 'react'
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
} from '@/api/notifications'
import { getApiErrorMessage } from '@/api/axios'

export const NOTIFICATION_POLL_MS = 60_000

export function useNotifications({ enabled = true, pollMs = NOTIFICATION_POLL_MS } = {}) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refreshUnreadCount = useCallback(async () => {
    if (!enabled) return 0
    try {
      const res = await getUnreadNotificationCount()
      const count = res.data?.unread_count ?? res.unread_count ?? 0
      setUnreadCount(count)
      setError('')
      return count
    } catch (err) {
      setError(getApiErrorMessage(err))
      return 0
    }
  }, [enabled])

  const refresh = useCallback(
    async (params = { limit: 10, unreadOnly: false }) => {
      if (!enabled) return null
      try {
        const res = await getNotifications(params)
        const list = res.data ?? []
        setNotifications(list)
        setError('')
        return res
      } catch (err) {
        setError(getApiErrorMessage(err))
        return null
      }
    },
    [enabled],
  )

  const refreshRecent = useCallback(() => refresh({ limit: 10, unreadOnly: false }), [refresh])

  useEffect(() => {
    if (!enabled) return undefined

    refreshUnreadCount()

    const interval = setInterval(refreshUnreadCount, pollMs)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshUnreadCount()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, pollMs, refreshUnreadCount])

  const markRead = useCallback(
    async (id) => {
      await markNotificationRead(id)
      await refreshUnreadCount()
    },
    [refreshUnreadCount],
  )

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead()
    await refreshUnreadCount()
  }, [refreshUnreadCount])

  const removeNotification = useCallback(
    async (id) => {
      await deleteNotification(id)
      await refreshUnreadCount()
    },
    [refreshUnreadCount],
  )

  const clearAllNotifications = useCallback(async () => {
    await deleteAllNotifications()
    await refreshUnreadCount()
    setNotifications([])
  }, [refreshUnreadCount])

  return {
    notifications,
    unreadCount,
    loading,
    error,
    setLoading,
    refresh,
    refreshUnreadCount,
    refreshRecent,
    markRead,
    markAllRead,
    removeNotification,
    clearAllNotifications,
  }
}
