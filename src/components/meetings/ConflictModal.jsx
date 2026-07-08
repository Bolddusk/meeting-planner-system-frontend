import { AlertTriangle } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { formatDateTime } from '@/utils/formatDate'

export default function ConflictModal({ open, onClose, details, timezone = 'UTC' }) {
  if (!details) return null

  const roomConflict = details.room
  const participantConflicts = details.participants ?? []

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Scheduling conflict detected"
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close and adjust
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900">
            The selected time overlaps with existing meetings. Please choose a different time,
            room, or participants.
          </p>
        </div>

        {roomConflict && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <h3 className="font-semibold text-red-900">Room conflict</h3>
            <p className="mt-1 text-sm text-red-800">
              <strong>{roomConflict.title}</strong>
            </p>
            <p className="text-sm text-red-700">
              {formatDateTime(roomConflict.start_time, timezone)} —{' '}
              {formatDateTime(roomConflict.end_time, timezone)}
            </p>
          </div>
        )}

        {participantConflicts.length > 0 && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
            <h3 className="font-semibold text-orange-900">Participant conflicts</h3>
            <ul className="mt-2 space-y-2">
              {participantConflicts.map((p, i) => (
                <li key={`${p.meeting_id}-${p.user_id}-${i}`} className="text-sm text-orange-800">
                  <strong>User #{p.user_id}</strong> — {p.title}
                  <br />
                  <span className="text-orange-700">
                    {formatDateTime(p.start_time, timezone)} —{' '}
                    {formatDateTime(p.end_time, timezone)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}
