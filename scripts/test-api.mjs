import axios from 'axios'

const API = 'http://localhost:5000/api'

async function test() {
  const results = []
  try {
    const login = await axios.post(`${API}/auth/login`, {
      email: 'superadmin@meetingplanner.local',
      password: 'SuperAdmin@123',
    })
    const token = login.data.data.tokens.accessToken
    const h = { Authorization: `Bearer ${token}` }

    const rooms = await axios.get(`${API}/rooms`, { headers: h })
    results.push(`rooms: ${rooms.data.data.length} items`)

    const meetings = await axios.get(`${API}/meetings`, {
      headers: h,
      params: { view: 'list', limit: 1 },
    })
    results.push(`meetings: ${meetings.data.meta.total} total`)

    const cal = await axios.get(`${API}/meetings`, {
      headers: h,
      params: { view: 'calendar', from: '2026-07-01', to: '2026-07-31' },
    })
    results.push(`calendar: ${cal.data.data.length} events`)

    const id = meetings.data.data[0]?.id
    if (id) {
      const detail = await axios.get(`${API}/meetings/${id}`, { headers: h })
      results.push(`detail: meeting ${detail.data.data.id} ok`)
    }

    console.log('API_OK', results.join(' | '))
  } catch (e) {
    console.log('API_FAIL', e.response?.data?.error?.message || e.message)
    process.exit(1)
  }
}

test()
