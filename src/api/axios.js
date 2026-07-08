import axios from 'axios'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '@/utils/tokens'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshPromise = null

async function refreshAccessToken() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  try {
    const { data } = await axios.post(
      `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/refresh`,
      { refreshToken },
    )
    const envelope = data
    if (envelope.success && envelope.data?.accessToken) {
      setTokens({
        accessToken: envelope.data.accessToken,
        refreshToken: envelope.data.refreshToken ?? refreshToken,
      })
      return envelope.data.accessToken
    }
  } catch {
    clearTokens()
  }
  return null
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null
        })
      }
      const newToken = await refreshPromise
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      }
      clearTokens()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export default api

export function getApiErrorMessage(error) {
  return (
    error?.response?.data?.error?.message ||
    error?.message ||
    'Something went wrong. Please try again.'
  )
}
