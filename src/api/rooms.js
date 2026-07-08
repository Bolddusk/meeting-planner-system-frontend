import api from './axios'

export async function getRooms() {
  const { data } = await api.get('/rooms')
  return data
}

export async function createRoom(payload) {
  const { data } = await api.post('/rooms', payload)
  return data
}
