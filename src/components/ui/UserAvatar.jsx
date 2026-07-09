import { useEffect, useState } from 'react'
import { User } from 'lucide-react'
import { fetchAvatarBlob } from '@/api/users'
import { cn } from '@/utils/cn'

export default function UserAvatar({ user, className, size = 'md' }) {
  const [src, setSrc] = useState(null)

  const sizeClass =
    size === 'lg' ? 'h-16 w-16 text-xl' : size === 'sm' ? 'h-9 w-9 text-sm' : 'h-12 w-12 text-base'

  useEffect(() => {
    let objectUrl
    let cancelled = false

    async function load() {
      if (!user?.avatar_url) {
        setSrc(null)
        return
      }
      try {
        const blob = await fetchAvatarBlob()
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      } catch {
        if (!cancelled) setSrc(null)
      }
    }

    load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [user?.avatar_url, user?.id])

  if (src) {
    return (
      <img
        src={src}
        alt={user?.full_name || 'Profile'}
        className={cn('rounded-full object-cover', sizeClass, className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-primary-700 font-semibold text-white',
        sizeClass,
        className,
      )}
    >
      {user?.full_name?.charAt(0)?.toUpperCase() || <User className="h-4 w-4" />}
    </div>
  )
}
