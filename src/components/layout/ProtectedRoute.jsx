import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { canAccessExportsPage } from '@/utils/permissions'

export default function ProtectedRoute({ children, adminOnly = false, exportsPage = false }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-700" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (adminOnly) {
    const role = user?.role?.code
    if (!['SUPER_ADMIN', 'ADMIN'].includes(role)) {
      return <Navigate to="/dashboard" replace />
    }
  }

  if (exportsPage && !canAccessExportsPage(user)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
