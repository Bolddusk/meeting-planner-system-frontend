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

    const rooms = await axios.get(`${API}/rooms`, { headers: h })
    const roomId = rooms.data.data[0]?.id

    const created = await axios.post(
      `${API}/meetings`,
      {
        title: 'M4 Test Weekly',
        start_time: '2026-07-14T09:00:00.000Z',
        end_time: '2026-07-14T10:00:00.000Z',
        room_id: roomId,
        rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=4',
        participants: [],
      },
      { headers: h },
    )
    const masterId = created.data.data.id
    console.log('create_recurring=ok', masterId, created.data.data.is_recurring)

    const cal = await axios.get(`${API}/meetings`, {
      headers: h,
      params: { view: 'calendar', from: '2026-07-01', to: '2026-08-31' },
    })
    const series = cal.data.data.filter((e) => e.title?.includes('M4 Test Weekly'))
    console.log('calendar_occurrences=', series.length)

    if (series.length > 1) {
      const occId = series[1].id
      await axios.delete(`${API}/meetings/${occId}`, { headers: h, params: { scope: 'this' } })
      const cal2 = await axios.get(`${API}/meetings`, {
        headers: h,
        params: { view: 'calendar', from: '2026-07-01', to: '2026-08-31' },
      })
      const after = cal2.data.data.filter((e) => e.title?.includes('M4 Test Weekly'))
      console.log('after_cancel_this=', after.length, '(was', series.length, ')')
    }

    console.log('M4_API_OK')
  } catch (e) {
    console.log('M4_API_FAIL', e.response?.data?.error?.message || e.message)
    process.exit(1)
  }
}

test()
