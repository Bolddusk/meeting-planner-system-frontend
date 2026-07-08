import { create } from 'zustand'
import {
  login as apiLogin,
  logout as apiLogout,
  fetchCurrentUser,
  persistMockUser,
  clearMockUser,
} from '@/api/auth'
import { setTokens, clearTokens, getAccessToken } from '@/utils/tokens'

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    set({ isLoading: true })
    try {
      const token = getAccessToken()
      if (!token && import.meta.env.VITE_USE_MOCK_AUTH !== 'true') {
        set({ user: null, isAuthenticated: false, isLoading: false })
        return
      }
      const user = await fetchCurrentUser()
      set({ user, isAuthenticated: !!user, isLoading: false })
    } catch {
      clearTokens()
      clearMockUser()
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },

  login: async (email, password) => {
    set({ error: null, isLoading: true })
    try {
      const result = await apiLogin(email, password)
      setTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      })
      persistMockUser(result.user)
      set({ user: result.user, isAuthenticated: true, isLoading: false, error: null })
      return result.user
    } catch (err) {
      const message = err?.response?.data?.error?.message || err.message || 'Login failed'
      set({ error: message, isLoading: false })
      throw new Error(message)
    }
  },

  logout: async () => {
    await apiLogout()
    clearTokens()
    clearMockUser()
    set({ user: null, isAuthenticated: false, error: null })
  },

  clearError: () => set({ error: null }),

  refreshUser: async () => {
    const user = await fetchCurrentUser()
    if (user) set({ user })
    return user
  },
}))
