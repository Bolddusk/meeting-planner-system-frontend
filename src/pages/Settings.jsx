import { useEffect, useState } from 'react'
import PageHero from '@/components/ui/PageHero'
import Card, { CardBody, CardHeader } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useAuth, usePermission } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/authStore'
import { updateReminderPreferences } from '@/api/notifications'
import { getApiErrorMessage } from '@/api/axios'

const CHANNEL_OPTIONS = [
  { value: 'EMAIL', label: 'Email notifications' },
  { value: 'IN_APP', label: 'In-app notifications' },
]

const LEAD_TIME_OPTIONS = [
  { value: 1440, label: '1 day before (1440 min)' },
  { value: 60, label: '1 hour before (60 min)' },
  { value: 15, label: '15 minutes before (15 min)' },
]

const DEFAULT_PREFERENCES = {
  channels: ['EMAIL', 'IN_APP'],
  lead_times: [1440, 60, 15],
}

export default function Settings() {
  const { user } = useAuth()
  const { can } = usePermission()
  const refreshUser = useAuthStore((s) => s.refreshUser)
  const canManageReminders = can('reminder.preferences.manage')

  const [channels, setChannels] = useState(DEFAULT_PREFERENCES.channels)
  const [leadTimes, setLeadTimes] = useState(DEFAULT_PREFERENCES.lead_times)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const prefs = user?.reminderPreference ?? user?.reminder_preferences
    if (prefs) {
      setChannels(prefs.channels ?? DEFAULT_PREFERENCES.channels)
      setLeadTimes(prefs.lead_times ?? DEFAULT_PREFERENCES.lead_times)
    }
  }, [user])

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

  const handleSave = async () => {
    if (channels.length === 0) {
      setError('Select at least one notification channel.')
      return
    }
    if (leadTimes.length === 0) {
      setError('Select at least one reminder lead time.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')
    try {
      await updateReminderPreferences({ channels, lead_times: leadTimes })
      await refreshUser()
      setMessage('Reminder preferences saved successfully.')
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="ACCOUNT"
        title="Settings"
        description="Manage your profile and reminder preferences."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">Profile</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input label="Full name" defaultValue={user?.full_name} readOnly />
            <Input label="Email" defaultValue={user?.email} readOnly />
            <Input label="Phone" defaultValue={user?.phone || ''} readOnly />
            <Input label="Timezone" defaultValue={user?.timezone || 'UTC'} readOnly />
            <p className="text-xs text-slate-500">
              Profile editing will be available when PATCH /api/users/me is deployed.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">Reminder Preferences</h3>
          </CardHeader>
          <CardBody className="space-y-4">
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
              <Button onClick={handleSave} loading={saving}>
                Save preferences
              </Button>
            ) : (
              <p className="text-xs text-slate-500">
                You do not have permission to manage reminder preferences.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
