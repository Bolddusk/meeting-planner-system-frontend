import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import PageHero from '@/components/ui/PageHero'
import Card, { CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { getRooms, createRoom } from '@/api/rooms'
import { getApiErrorMessage } from '@/api/axios'
import { usePermission } from '@/hooks/useAuth'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  capacity: z.coerce.number().min(1, 'Capacity must be at least 1'),
  location: z.string().min(1, 'Location is required'),
  is_virtual: z.boolean(),
})

export default function Rooms() {
  const { can } = usePermission()
  const canManage = can('room.manage')

  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', capacity: 10, location: '', is_virtual: false },
  })

  const loadRooms = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getRooms()
      setRooms(res.data ?? [])
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  const openCreate = () => {
    reset({ name: '', capacity: 10, location: '', is_virtual: false })
    setSubmitError('')
    setModalOpen(true)
  }

  const onSubmit = async (values) => {
    setSubmitError('')
    try {
      await createRoom(values)
      setModalOpen(false)
      await loadRooms()
    } catch (err) {
      setSubmitError(getApiErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="ADMINISTRATION"
        title="Meeting Rooms"
        description="Manage physical and virtual meeting rooms. Rooms are used when scheduling meetings."
      />

      <Card>
        <CardBody className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{rooms.length} room(s) available</p>
            {canManage && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add room
              </Button>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-700" />
            </div>
          ) : rooms.length === 0 ? (
            <div className="py-16 text-center text-slate-500">No rooms found</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Capacity</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rooms.map((room) => (
                    <tr key={room.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{room.name}</td>
                      <td className="px-4 py-3 text-slate-600">{room.capacity}</td>
                      <td className="px-4 py-3 text-slate-600">{room.location}</td>
                      <td className="px-4 py-3">
                        <Badge variant={room.is_virtual ? 'info' : 'default'}>
                          {room.is_virtual ? 'Virtual' : 'Physical'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Meeting Room"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
              Create room
            </Button>
          </>
        }
      >
        {submitError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Room name" error={errors.name?.message} {...register('name')} />
          <Input
            label="Capacity"
            type="number"
            min={1}
            error={errors.capacity?.message}
            {...register('capacity')}
          />
          <Input label="Location" error={errors.location?.message} {...register('location')} />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="rounded border-slate-300" {...register('is_virtual')} />
            Virtual room
          </label>
        </form>
      </Modal>
    </div>
  )
}
