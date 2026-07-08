import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import RichTextEditor from '@/components/ui/RichTextEditor'
import {
  getMeetingNotes,
  createNote,
  updateNote,
  deleteNote,
} from '@/api/notes'
import { getApiErrorMessage } from '@/api/axios'
import { formatDateTime } from '@/utils/formatDate'
import { NOTE_TYPE_VARIANT, OFFICIAL_NOTE_TYPES, isOfficialNoteType } from '@/utils/noteTypes'
import { useAuth, usePermission } from '@/hooks/useAuth'
import { isAdminOrAbove } from '@/utils/permissions'

const EMPTY_CONTENT = '<p></p>'

export default function NotesTab({ meetingId }) {
  const { user } = useAuth()
  const { can } = usePermission()
  const timezone = user?.timezone || 'UTC'

  const canOfficialNotes = can('note.official.edit')
  const canPersonalNotes = can('note.personal.edit')

  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  const [noteType, setNoteType] = useState('MINUTES')
  const [content, setContent] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)

  const loadNotes = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getMeetingNotes(meetingId)
      setNotes(res.data ?? [])
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const canEditNote = (note) => {
    if (isOfficialNoteType(note.note_type)) return canOfficialNotes
    return note.author?.id === user?.id || isAdminOrAbove(user)
  }

  const canDeleteNote = (note) => canEditNote(note)

  const openCreate = (type) => {
    setEditingNote(null)
    setNoteType(type)
    setContent('')
    setIsPrivate(type === 'PERSONAL')
    setFormOpen(true)
  }

  const openEdit = (note) => {
    setEditingNote(note)
    setNoteType(note.note_type)
    setContent(note.content || '')
    setIsPrivate(note.is_private)
    setFormOpen(true)
  }

  const handleSave = async () => {
    const stripped = content.replace(/<[^>]*>/g, '').trim()
    if (!stripped) {
      setError('Note content is required.')
      return
    }

    setSaving(true)
    setError('')
    try {
      if (editingNote) {
        await updateNote(meetingId, editingNote.id, { content })
      } else {
        await createNote(meetingId, {
          note_type: noteType,
          content,
          is_private: noteType === 'PERSONAL' ? isPrivate : false,
        })
      }
      setFormOpen(false)
      await loadNotes()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      await deleteNote(meetingId, deleteTarget.id)
      setDeleteTarget(null)
      await loadNotes()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-700" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {canOfficialNotes && (
          <>
            <Button size="sm" onClick={() => openCreate('MINUTES')}>
              <Plus className="h-4 w-4" />
              Add minutes
            </Button>
            <Button size="sm" variant="secondary" onClick={() => openCreate('DECISION')}>
              <Plus className="h-4 w-4" />
              Add decision
            </Button>
          </>
        )}
        {canPersonalNotes && (
          <Button size="sm" variant="ghost" onClick={() => openCreate('PERSONAL')}>
            <Plus className="h-4 w-4" />
            Add personal note
          </Button>
        )}
      </div>

      {error && !formOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notes.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">No notes yet.</p>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div key={note.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={NOTE_TYPE_VARIANT[note.note_type] ?? 'default'}>
                    {note.note_type}
                  </Badge>
                  {note.is_private && <Badge variant="default">Private</Badge>}
                  <span className="text-xs text-slate-400">v{note.version}</span>
                </div>
                {(canEditNote(note) || canDeleteNote(note)) && (
                  <div className="flex gap-1">
                    {canEditNote(note) && (
                      <button
                        type="button"
                        onClick={() => openEdit(note)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary-700"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {canDeleteNote(note) && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(note)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                by {note.author?.full_name} · {formatDateTime(note.updated_at || note.created_at, timezone)}
              </p>
              <div
                className="prose prose-sm mt-4 max-w-none border-t border-slate-100 pt-4 text-slate-700"
                dangerouslySetInnerHTML={{ __html: note.content }}
              />
            </div>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingNote ? 'Edit note' : 'Add note'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingNote ? 'Save changes' : 'Create note'}
            </Button>
          </>
        }
      >
        {error && formOpen && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!editingNote && canOfficialNotes && noteType !== 'PERSONAL' && (
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Note type</label>
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {OFFICIAL_NOTE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}

        {!editingNote && noteType === 'PERSONAL' && (
          <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="rounded border-slate-300"
            />
            Private (only visible to you)
          </label>
        )}

        <RichTextEditor value={content} onChange={setContent} />
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete note"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={saving}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete this note?</p>
      </Modal>
    </div>
  )
}
