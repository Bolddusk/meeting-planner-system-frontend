import axios from 'axios'

const API = 'http://localhost:5000/api'

async function test() {
  try {
    const login = await axios.post(`${API}/auth/login`, {
      email: 'superadmin@meetingplanner.local',
      password: 'SuperAdmin@123',
    })
    const token = login.data.data.tokens.accessToken
    const h = { Authorization: `Bearer ${token}` }

    const meetings = await axios.get(`${API}/meetings`, {
      headers: h,
      params: { view: 'list', limit: 1, status: 'SCHEDULED' },
    })
    const m = meetings.data.data[0]
    if (!m) {
      console.log('M6_API_SKIP no scheduled meeting')
      return
    }

    const audit = await axios.get(`${API}/audit-log`, {
      headers: h,
      params: { meetingId: m.id, limit: 1 },
    })
    console.log('audit_log=ok total=' + (audit.data.meta?.total ?? 0))

    const reschedule = await axios.post(
      `${API}/meetings/${m.id}/reschedule`,
      {
        start_time: m.end_time,
        end_time: new Date(new Date(m.end_time).getTime() + 3600000).toISOString(),
        reason: 'M6 frontend test',
      },
      { headers: h },
    )
    console.log('reschedule=ok status=' + reschedule.data.data?.status)

    const audit2 = await axios.get(`${API}/audit-log`, {
      headers: h,
      params: { meetingId: m.id, limit: 5 },
    })
    console.log('audit_after_reschedule=' + (audit2.data.meta?.total ?? 0))
    console.log('M6_API_OK')
  } catch (e) {
    console.log('M6_API_FAIL', e.response?.data?.error?.message || e.message)
    process.exit(1)
  }
}

test()
