import { useCallback, useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import { getPersonalNote, savePersonalNote } from '@/api/meetings'
import { getApiErrorMessage } from '@/api/axios'
import { usePermission } from '@/hooks/useAuth'

export default function PersonalNotesPanel({ meetingId }) {
  const { can } = usePermission()
  const canEdit = can('note.personal.edit')

  const [content, setContent] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadNote = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getPersonalNote(meetingId)
      const note = res.data?.note
      setContent(note?.content || '')
      setIsPrivate(note?.is_private ?? true)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  useEffect(() => {
    if (canEdit) loadNote()
    else setLoading(false)
  }, [canEdit, loadNote])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await savePersonalNote(meetingId, { content, is_private: isPrivate })
      setMessage('Personal notes saved.')
      await loadNote()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (!canEdit) return null

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-700" />
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-slate-900">My personal notes</h4>
          <p className="text-xs text-slate-500">Private to you — separate from shared meeting notes.</p>
        </div>
        <Button size="sm" onClick={handleSave} loading={saving}>
          Save
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {message}
        </div>
      )}

      <textarea
        rows={5}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Your private prep notes for this meeting..."
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
      />

      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
          className="rounded border-slate-300"
        />
        Keep private (only visible to you)
      </label>
    </div>
  )
}
