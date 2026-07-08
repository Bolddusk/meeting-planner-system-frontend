import { useAuthStore } from '@/store/authStore'
import { can as checkPermission } from '@/utils/permissions'

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading = useAuthStore((s) => s.isLoading)
  const error = useAuthStore((s) => s.error)
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const clearError = useAuthStore((s) => s.clearError)

  return { user, isAuthenticated, isLoading, error, login, logout, clearError }
}

export function usePermission() {
  const user = useAuthStore((s) => s.user)
  const can = (permission) => checkPermission(user, permission)
  return { can, user }
}
