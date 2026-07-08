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
      params: { view: 'list', limit: 1 },
    })
    const mid = meetings.data.data[0]?.id
    if (!mid) {
      console.log('M7_SKIP no meeting')
      return
    }

    const note = await axios.post(
      `${API}/meetings/${mid}/notes`,
      { note_type: 'MINUTES', content: '<p>M7 test minutes</p>' },
      { headers: h },
    )
    console.log('create_note=ok id=' + note.data.data?.id)

    const notes = await axios.get(`${API}/meetings/${mid}/notes`, { headers: h })
    console.log('notes_count=' + (notes.data.data?.length ?? 0))

    const item = await axios.post(
      `${API}/action-items`,
      {
        meeting_id: mid,
        assignee_id: login.data.data.user.id,
        title: 'M7 follow up',
        due_date: '2026-07-25',
      },
      { headers: h },
    )
    console.log('create_action_item=ok id=' + item.data.data?.id)

    const items = await axios.get(`${API}/action-items`, {
      headers: h,
      params: { meetingId: mid },
    })
    console.log('action_items=' + (items.data.meta?.total ?? 0))
    console.log('M7_API_OK')
  } catch (e) {
    console.log('M7_API_FAIL', e.response?.data?.error?.message || e.message)
    process.exit(1)
  }
}

test()
