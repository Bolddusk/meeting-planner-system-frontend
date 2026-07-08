import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useLocation } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export default function Login() {
  const { login, isAuthenticated, isLoading, error, clearError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/dashboard'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: 'superadmin@meetingplanner.local',
      password: 'SuperAdmin@123',
    },
  })

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true })
  }, [isAuthenticated, navigate, from])

  useEffect(() => {
    return () => clearError()
  }, [clearError])

  const onSubmit = async (values) => {
    try {
      await login(values.email, values.password)
      navigate(from, { replace: true })
    } catch {
      // error handled in store
    }
  }

  if (isLoading && isAuthenticated) return null

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 p-12 text-white lg:flex">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary-200">
            Government of Pakistan
          </p>
          <h1 className="mt-3 text-4xl font-bold">Meeting Planner</h1>
          <p className="mt-2 text-lg text-primary-100">Admin Panel</p>
        </div>
        <div className="space-y-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
            <CalendarDays className="h-8 w-8" />
          </div>
          <p className="max-w-md text-primary-100">
            Schedule, manage, and track government meetings across departments. Secure
            role-based access for administrators and secretaries.
          </p>
        </div>
        <p className="text-sm text-primary-300">Desktop admin panel — authorized personnel only</p>
      </div>

      <div className="flex w-full flex-col justify-center px-8 py-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-700">
              Government of Pakistan
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Meeting Planner Admin</h1>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter your credentials to access the admin panel
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Sign in
            </Button>
          </form>

          {import.meta.env.VITE_USE_MOCK_AUTH === 'true' && (
            <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Mock auth enabled. Use <strong>superadmin@meetingplanner.local</strong> /{' '}
              <strong>SuperAdmin@123</strong>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
