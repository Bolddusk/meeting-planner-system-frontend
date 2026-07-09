import { useEffect, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import PageHero from '@/components/ui/PageHero'
import Card, { CardBody, CardHeader } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import UserAvatar from '@/components/ui/UserAvatar'
import { useAuth, usePermission } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/authStore'
import { updateReminderPreferences } from '@/api/notifications'
import { updateProfile, changePassword, uploadAvatar } from '@/api/users'
import { getApiErrorMessage } from '@/api/axios'

const CHANNEL_OPTIONS = [
  { value: 'EMAIL', label: 'Email notifications' },
  { value: 'IN_APP', label: 'In-app notifications' },
]

const LEAD_TIME_OPTIONS = [{ value: 60, label: '1 hour before (60 min)' }]

const TIMEZONE_OPTIONS = [
  'Asia/Karachi',
  'UTC',
  'Asia/Dubai',
  'Europe/London',
  'America/New_York',
]

const DEFAULT_PREFERENCES = {
  channels: ['EMAIL', 'IN_APP'],
  lead_times: [60],
}

export default function Settings() {
  const { user } = useAuth()
  const { can } = usePermission()
  const refreshUser = useAuthStore((s) => s.refreshUser)
  const canManageReminders = can('reminder.preferences.manage')

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [timezone, setTimezone] = useState('Asia/Karachi')
  const [channels, setChannels] = useState(DEFAULT_PREFERENCES.channels)
  const [leadTimes, setLeadTimes] = useState(DEFAULT_PREFERENCES.lead_times)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [profileSaving, setProfileSaving] = useState(false)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [reminderSaving, setReminderSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    setFullName(user.full_name || '')
    setPhone(user.phone || '')
    setTimezone(user.timezone || 'Asia/Karachi')
    const prefs = user.reminderPreference ?? user.reminder_preferences
    if (prefs) {
      setChannels(prefs.channels ?? DEFAULT_PREFERENCES.channels)
      setLeadTimes(prefs.lead_times ?? DEFAULT_PREFERENCES.lead_times)
    }
  }, [user])

  const showFlash = (text, isError = false) => {
    if (isError) {
      setError(text)
      setMessage('')
    } else {
      setMessage(text)
      setError('')
    }
  }

  const handleProfileSave = async () => {
    setProfileSaving(true)
    try {
      await updateProfile({ full_name: fullName, phone: phone || undefined, timezone })
      await refreshUser()
      showFlash('Profile updated successfully.')
    } catch (err) {
      showFlash(getApiErrorMessage(err), true)
    } finally {
      setProfileSaving(false)
    }
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      showFlash('Image must be 2 MB or smaller.', true)
      return
    }

    setAvatarSaving(true)
    try {
      const reader = new FileReader()
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      await uploadAvatar(dataUrl)
      await refreshUser()
      showFlash('Profile photo updated.')
    } catch (err) {
      showFlash(getApiErrorMessage(err), true)
    } finally {
      setAvatarSaving(false)
      e.target.value = ''
    }
  }

  const handlePasswordSave = async () => {
    if (newPassword !== confirmPassword) {
      showFlash('New passwords do not match.', true)
      return
    }
    if (newPassword.length < 8) {
      showFlash('New password must be at least 8 characters.', true)
      return
    }

    setPasswordSaving(true)
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showFlash('Password changed successfully.')
    } catch (err) {
      showFlash(getApiErrorMessage(err), true)
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleReminderSave = async () => {
    if (channels.length === 0) {
      showFlash('Select at least one notification channel.', true)
      return
    }
    setReminderSaving(true)
    try {
      await updateReminderPreferences({ channels, lead_times: leadTimes })
      await refreshUser()
      showFlash('Reminder preferences saved.')
    } catch (err) {
      showFlash(getApiErrorMessage(err), true)
    } finally {
      setReminderSaving(false)
    }
  }

  const handleCopyCalendar = async () => {
    const url = user?.calendar_feed_url
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleChannel = (value) => {
    setChannels((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value],
    )
  }

  const toggleLeadTime = (value) => {
    setLeadTimes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value].sort((a, b) => b - a),
    )
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="ACCOUNT"
        title="Settings"
        description="Manage your profile, security, reminders, and calendar subscription."
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">Profile</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-center gap-4">
              <UserAvatar user={user} size="lg" />
              <div>
                <label className="inline-flex cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAvatarChange}
                    disabled={avatarSaving}
                  />
                  <span className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    {avatarSaving ? 'Uploading...' : 'Change photo'}
                  </span>
                </label>
                <p className="mt-1 text-xs text-slate-500">JPG or PNG, max 2 MB</p>
              </div>
            </div>

            <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Input label="Email" value={user?.email || ''} readOnly />
            <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleProfileSave} loading={profileSaving}>
              Save profile
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">Security</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button onClick={handlePasswordSave} loading={passwordSaving}>
              Change password
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">Reminder preferences</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Channels</p>
              {CHANNEL_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={channels.includes(opt.value)}
                    onChange={() => toggleChannel(opt.value)}
                    disabled={!canManageReminders}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Remind me before meeting</p>
              <p className="text-xs text-slate-500">
                The system currently sends reminders 1 hour before each meeting start time.
              </p>
              {LEAD_TIME_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={leadTimes.includes(opt.value)}
                    onChange={() => toggleLeadTime(opt.value)}
                    disabled={!canManageReminders}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {canManageReminders ? (
              <Button onClick={handleReminderSave} loading={reminderSaving}>
                Save preferences
              </Button>
            ) : (
              <p className="text-xs text-slate-500">
                You do not have permission to manage reminder preferences.
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">Calendar subscription</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            {user?.calendar_feed_url ? (
              <>
                <p className="text-sm text-slate-600">
                  Add this URL to Outlook, Google Calendar, or Apple Calendar to sync your meetings.
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={user.calendar_feed_url}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                  />
                  <Button variant="secondary" size="sm" onClick={handleCopyCalendar}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <a
                  href={user.calendar_feed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex text-sm font-medium text-primary-700 hover:text-primary-800"
                >
                  Open calendar feed
                </a>
                <p className="text-xs text-slate-500">Feed links expire after one year. Refresh this page for a new URL.</p>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Calendar subscription is not available for your account yet.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
