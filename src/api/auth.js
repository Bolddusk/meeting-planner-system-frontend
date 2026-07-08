import api from './axios'
import { normalizeUser } from '@/utils/user'

const USE_MOCK = import.meta.env.VITE_USE_MOCK_AUTH === 'true'

const MOCK_USERS = {
  'superadmin@meetingplanner.local': {
    password: 'SuperAdmin@123',
    user: {
      id: 1,
      full_name: 'Super Admin',
      email: 'superadmin@meetingplanner.local',
      phone: '+92-300-0000001',
      timezone: 'Asia/Karachi',
      is_active: true,
      role: { id: 1, code: 'SUPER_ADMIN', name: 'Super Admin' },
      department: { id: 1, name: 'Administration' },
    },
  },
  'admin@meetingplanner.local': {
    password: 'Admin@123',
    user: {
      id: 2,
      full_name: 'System Admin',
      email: 'admin@meetingplanner.local',
      phone: '+92-300-0000002',
      timezone: 'Asia/Karachi',
      is_active: true,
      role: { id: 2, code: 'ADMIN', name: 'Admin' },
      department: { id: 1, name: 'Administration' },
    },
  },
}

function enrichUser(user) {
  return normalizeUser(user)
}

function mockLogin(email, password) {
  const record = MOCK_USERS[email.toLowerCase()]
  if (!record || record.password !== password) {
    const err = new Error('Invalid email or password')
    err.response = { data: { success: false, error: { message: 'Invalid email or password' } } }
    throw err
  }
  const user = enrichUser(record.user)
  return {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    user,
  }
}

export async function login(email, password) {
  if (USE_MOCK) {
    return mockLogin(email, password)
  }
  const { data } = await api.post('/auth/login', { email, password })
  if (!data.success) throw new Error(data.error?.message || 'Login failed')
  const user = enrichUser(data.data.user)
  const roleCode = user.role?.code
  if (!['SUPER_ADMIN', 'ADMIN', 'SECRETARY', 'USER'].includes(roleCode)) {
    throw new Error('Your account does not have access to this application.')
  }
  return {
    accessToken: data.data.tokens?.accessToken ?? data.data.accessToken,
    refreshToken: data.data.tokens?.refreshToken ?? data.data.refreshToken,
    user,
  }
}

export async function logout() {
  if (USE_MOCK) return
  try {
    await api.post('/auth/logout')
  } catch {
    // ignore logout errors
  }
}

export async function fetchCurrentUser() {
  if (USE_MOCK) {
    const stored = localStorage.getItem('mp_mock_user')
    if (!stored) return null
    return enrichUser(JSON.parse(stored))
  }
  const { data } = await api.get('/users/me')
  if (!data.success) return null
  return enrichUser(data.data)
}

export function persistMockUser(user) {
  if (USE_MOCK && user) {
    localStorage.setItem('mp_mock_user', JSON.stringify(user))
  }
}

export function clearMockUser() {
  localStorage.removeItem('mp_mock_user')
}

export async function registerUser(payload) {
  const { data } = await api.post('/auth/register', payload)
  return data
}
