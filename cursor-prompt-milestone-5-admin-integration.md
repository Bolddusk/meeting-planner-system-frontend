# Milestone 5 — Notifications & Reminders (Admin Panel Integration)

Wire the **notifications bell** and **reminder preferences** in Settings. Requires Milestone 4 to be done.

**Base URL:** `http://localhost:5000/api`

---

## What's new in Milestone 5

| Feature | Status |
|---------|--------|
| In-app notifications (INVITE, REMINDER, CANCELLATION) | ✅ |
| Notification bell + unread count | ✅ build UI |
| `GET /api/notifications` | ✅ |
| `PATCH /api/notifications/:id/read` | ✅ |
| `PATCH /api/notifications/read-all` | ✅ bonus |
| Reminder preferences in Settings | ✅ already in M2 API |
| Email invites on meeting create | ✅ (if SMTP configured) |
| Email reminders (cron every minute) | ✅ backend |
| Reschedule notifications | ❌ Milestone 6 |
| ICS in email | ❌ Milestone 8 |

---

## Run migration

```powershell
cd server
npm run db:migrate
npm run dev
```

Server logs: `Reminder worker scheduled (every minute)`

---

## 1. Notifications API

### GET `/api/notifications`

**Auth:** Required

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Default 1 |
| `limit` | number | Default 20, max 100 |
| `unreadOnly` | boolean | Filter unread only |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "INVITE",
      "title": "Meeting invite: Weekly Planning",
      "body": "Super Admin invited you to...",
      "is_read": false,
      "meeting_id": 1,
      "meeting": {
        "id": 1,
        "title": "Weekly Planning",
        "start_time": "2026-07-08T10:00:00.000Z",
        "status": "SCHEDULED"
      },
      "created_at": "2026-07-07T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1,
    "unreadCount": 3
  }
}
```

### PATCH `/api/notifications/:id/read`

Mark single notification as read.

**Response:** Updated notification object.

### PATCH `/api/notifications/read-all`

Mark all user's notifications as read.

**Response:** `{ "updated": 3 }`

---

## 2. Notification types & icons

| Type | Icon | Color | When |
|------|------|-------|------|
| `INVITE` | 📩 | blue | Meeting created, user is participant |
| `REMINDER` | ⏰ | orange | Before meeting (in-app channel) |
| `CANCELLATION` | ❌ | red | Meeting cancelled |
| `RESCHEDULE` | 🔄 | purple | Milestone 6 |
| `NOTE_ADDED` | 📝 | gray | Milestone 7 |
| `RESCHEDULE_REQUEST` | ❓ | yellow | Milestone 6 |

---

## 3. Top bar — Notification bell

Add to layout topbar:

```
┌─────────────────────────────────────────────┐
│  Dashboard          🔔(3)    Super Admin ▼  │
└─────────────────────────────────────────────┘
```

**On mount + every 60s:** poll `GET /api/notifications?limit=5&unreadOnly=true`  
**Unread badge:** `meta.unreadCount`

**Dropdown panel:**
```
┌──────────────────────────────────┐
│  Notifications    [Mark all read]│
├──────────────────────────────────┤
│  📩 Meeting invite: Weekly...    │
│     2 minutes ago                │
├──────────────────────────────────┤
│  ⏰ Reminder: Standup in 60 min  │
│     1 hour ago                   │
├──────────────────────────────────┤
│  View all notifications →        │
└──────────────────────────────────┘
```

**Click notification:**
1. `PATCH /api/notifications/:id/read`
2. Navigate to `/meetings/:meeting_id` if meeting_id exists

---

## 4. Full notifications page (optional)

Route: `/notifications`

- Full list with pagination
- Filter: All / Unread
- Mark all read button

---

## 5. Settings — Reminder preferences

Already available: `PATCH /api/users/me/reminder-preferences`

**GET from:** `GET /api/users/me` → `data.reminderPreference`

```json
{
  "channels": ["EMAIL", "IN_APP"],
  "lead_times": [1440, 60, 15]
}
```

**UI in Settings page:**

```
┌─────────────────────────────────────────┐
│  Reminder Preferences                   │
│                                         │
│  Channels:                              │
│  ☑ Email    ☑ In-app                   │
│                                         │
│  Remind me before meeting:              │
│  ☑ 1 day before (1440 min)              │
│  ☑ 1 hour before (60 min)               │
│  ☑ 15 minutes before (15 min)           │
│                                         │
│  [Save Preferences]                     │
└─────────────────────────────────────────┘
```

**Save:**
```javascript
PATCH /api/users/me/reminder-preferences
{
  "channels": ["EMAIL", "IN_APP"],
  "lead_times": [1440, 60, 15]
}
```

**Permission:** `reminder.preferences.manage` (all roles have this)

---

## 6. Axios helpers

```javascript
// client/src/api/notifications.js
import api from './axios';

export const getNotifications = (params) =>
  api.get('/notifications', { params });

export const markNotificationRead = (id) =>
  api.patch(`/notifications/${id}/read`);

export const markAllNotificationsRead = () =>
  api.patch('/notifications/read-all');

export const updateReminderPreferences = (data) =>
  api.patch('/users/me/reminder-preferences', data);
```

---

## 7. NotificationBell component (suggested)

```jsx
function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    const res = await getNotifications({ limit: 5 });
    setNotifications(res.data.data);
    setUnreadCount(res.data.meta.unreadCount);
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRead = async (notification) => {
    await markNotificationRead(notification.id);
    fetchNotifications();
    if (notification.meeting_id) {
      navigate(`/meetings/${notification.meeting_id}`);
    }
    setOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}>
        🔔
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>
      {open && <NotificationDropdown ... />}
    </div>
  );
}
```

---

## 8. Auto-triggers (backend — no frontend action needed)

| Event | What happens |
|-------|----------------|
| Meeting created | INVITE notification + email to participants |
| Meeting cancelled | CANCELLATION notification + cancel pending reminders |
| Reminder due | REMINDER in-app + email (cron every minute) |

---

## 9. SMTP config (for real emails)

In `server/.env`:
```env
EMAIL_ENABLED=true
SMTP_HOST=s9623.fra1.stableserver.net
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your@email.com
SMTP_PASS=yourpassword
SMTP_FROM=Meeting Planner <your@email.com>
```

If `EMAIL_ENABLED=false` — in-app notifications still work, emails skipped.

---

## 10. Build order

1. `api/notifications.js` helper
2. `NotificationBell` component in topbar
3. Reminder preferences section in Settings page
4. (Optional) Full `/notifications` page

---

## Not yet available

| Feature | Milestone |
|---------|-----------|
| RESCHEDULE notifications | 6 |
| NOTE_ADDED notifications | 7 |
| WebSocket real-time push | Not planned — use 60s polling |
| Push notifications (mobile) | Out of scope |

---

## Quick test

```bash
# 1. Login as superadmin
# 2. Create a meeting with a participant
# 3. Login as that participant → GET /api/notifications
# Should see INVITE notification

curl http://localhost:5000/api/notifications \
  -H "Authorization: Bearer TOKEN"

curl -X PATCH http://localhost:5000/api/notifications/1/read \
  -H "Authorization: Bearer TOKEN"
```

---

## Frontend prompt order reminder

| Done | File |
|------|------|
| ✅ | admin-frontend.md |
| ✅ | milestone-3.md |
| ✅/🔄 | milestone-4.md |
| **NOW** | **milestone-5.md (this file)** |
| Next | milestone-6.md (after backend M6) |
