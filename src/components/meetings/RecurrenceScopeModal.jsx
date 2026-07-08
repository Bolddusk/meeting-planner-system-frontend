import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { cn } from '@/utils/cn'

const SCOPES = [
  { value: 'this', label: 'This event only', description: 'Apply changes only to this occurrence' },
  {
    value: 'following',
    label: 'This and following events',
    description: 'Apply from this date forward; earlier events stay unchanged',
  },
  {
    value: 'series',
    label: 'All events in the series',
    description: 'Apply to the entire recurring series',
  },
]

export default function RecurrenceScopeModal({
  open,
  action = 'edit',
  onConfirm,
  onClose,
  loading = false,
}) {
  const [scope, setScope] = useState('this')
  const title = action === 'edit' ? 'Edit recurring meeting' : 'Cancel recurring meeting'
  const confirmLabel = action === 'edit' ? 'Save' : 'Confirm cancel'

  useEffect(() => {
    if (open) setScope('this')
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Close
          </Button>
          <Button
            variant={action === 'cancel' ? 'danger' : 'primary'}
            onClick={() => onConfirm(scope)}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-slate-600">
        This meeting is part of a recurring series. Choose how broadly to apply your changes.
      </p>
      <div className="space-y-2">
        {SCOPES.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              'flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors',
              scope === opt.value
                ? 'border-primary-600 bg-primary-50'
                : 'border-slate-200 hover:border-slate-300',
            )}
          >
            <input
              type="radio"
              name="recurrence-scope"
              value={opt.value}
              checked={scope === opt.value}
              onChange={() => setScope(opt.value)}
              className="mt-1"
            />
            <div>
              <p className="text-sm font-medium text-slate-900">{opt.label}</p>
              <p className="text-xs text-slate-500">{opt.description}</p>
            </div>
          </label>
        ))}
      </div>
    </Modal>
  )
}
