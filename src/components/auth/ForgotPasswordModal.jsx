import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { forgotPassword } from '@/api/auth'
import { getApiErrorMessage } from '@/api/axios'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})

export default function ForgotPasswordModal({ open, onClose }) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  const handleClose = () => {
    reset()
    setMessage('')
    setError('')
    onClose()
  }

  const onSubmit = async (values) => {
    setError('')
    setMessage('')
    try {
      const res = await forgotPassword(values.email)
      setMessage(res.message || 'If that email exists, a reset link has been sent.')
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Forgot password"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Close
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            Send reset link
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}
      <p className="mb-4 text-sm text-slate-600">
        Enter your email address and we will send you a link to reset your password.
      </p>
      <Input
        label="Email address"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />
    </Modal>
  )
}
