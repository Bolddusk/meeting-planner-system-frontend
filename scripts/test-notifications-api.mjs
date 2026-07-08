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

    const list = await axios.get(`${API}/notifications`, { headers: h, params: { limit: 5 } })
    console.log('notifications_list=ok unread=' + (list.data.meta?.unreadCount ?? 0))

    const prefs = await axios.patch(
      `${API}/users/me/reminder-preferences`,
      { channels: ['EMAIL', 'IN_APP'], lead_times: [1440, 60, 15] },
      { headers: h },
    )
    console.log('reminder_prefs=ok success=' + prefs.data.success)

    if (list.data.data?.length > 0) {
      const id = list.data.data[0].id
      await axios.patch(`${API}/notifications/${id}/read`, null, { headers: h })
      console.log('mark_read=ok')
    } else {
      console.log('mark_read=skipped (no notifications)')
    }

    await axios.patch(`${API}/notifications/read-all`, null, { headers: h })
    console.log('read_all=ok')
    console.log('M5_API_OK')
  } catch (e) {
    console.log('M5_API_FAIL', e.response?.data?.error?.message || e.message)
    process.exit(1)
  }
}

test()
