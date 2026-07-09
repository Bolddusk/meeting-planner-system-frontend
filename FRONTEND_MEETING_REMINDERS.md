# Frontend Integration: 1-Hour Meeting Reminders

Participants ko meeting se **1 hour pehle** automatically **email** aur **in-app notification** milti hai. Yeh poora flow **backend automatic** hai — frontend ko sirf notifications display karni hain.

---

## How it works (backend)

```
Meeting created / rescheduled
        ↓
Reminders scheduled (1 hour before start_time)
        ↓
Cron worker runs every minute
        ↓
Due reminders dispatched:
  • IN_APP → notification bell
  • EMAIL   → gov-style reminder email
```

| Trigger | Action |
|---------|--------|
| Meeting created | Schedule 1h reminders for all participants |
| Meeting rescheduled | Cancel old reminders → schedule new |
| Meeting cancelled | Cancel pending reminders |
| Server startup | Backfill reminders for upcoming meetings (14 days) |

**Who gets reminded:** All **participants** (including organizer)  
**Skipped:** Users with RSVP `DECLINED`, inactive users  
**Guests:** Not included (participants only — users with accounts)

---

## Reminder timing

**Default: 60 minutes (1 hour) before `start_time`**

Server env (optional):
```env
MEETING_REMINDER_LEAD_MINUTES=60
EMAIL_ENABLED=true
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=Meeting Planner <noreply@example.com>
CLIENT_BASE_URL=http://localhost:5173
```

---

## In-app notification (frontend)

### API — list notifications

```
GET /api/notifications?page=1&limit=20
Authorization: Bearer {token}
```

**Query params:**
| Param | Values |
|-------|--------|
| `unreadOnly` | `true` / `false` |
| `page`, `limit` | Pagination |

Filter by `type === 'REMINDER'` on the client after fetch (no server filter yet).

### Reminder notification shape

```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "type": "REMINDER",
      "title": "Meeting in 1 hour: Weekly Planning",
      "body": "Your meeting \"Weekly Planning\" starts in 1 hour.",
      "is_read": false,
      "meeting_id": 5,
      "meeting": {
        "id": 5,
        "title": "Weekly Planning",
        "start_time": "2026-07-10T10:00:00.000Z"
      },
      "created_at": "2026-07-10T09:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 3, "totalPages": 1, "unreadCount": 2 }
}
```

### Mark as read

```
PATCH /api/notifications/:id/read
PATCH /api/notifications/read-all
```

---

## Frontend UI checklist

### 1. Notification bell (header)

```javascript
// Poll every 60s or on page focus
const { data } = await api.get('/notifications', {
  params: { unreadOnly: true, limit: 10 },
});
const unreadCount = data.meta?.unreadCount ?? data.data.filter((n) => !n.is_read).length;
```

- Bell icon par **badge** with unread count
- Dropdown list: title + body + time ago
- Click item → `navigate(/meetings/${notification.meeting_id})`
- `type === 'REMINDER'` → green/amber icon (⏰)

### 2. REMINDER styling example

```jsx
function NotificationItem({ notification, onRead }) {
  const isReminder = notification.type === 'REMINDER';

  return (
    <button
      onClick={() => {
        onRead(notification.id);
        if (notification.meeting_id) {
          navigate(`/meetings/${notification.meeting_id}`);
        }
      }}
      className={notification.is_read ? 'opacity-60' : 'font-medium'}
    >
      {isReminder && <span aria-hidden>⏰</span>}
      <div>{notification.title}</div>
      <div className="text-sm text-muted">{notification.body}</div>
      <time>{formatRelative(notification.created_at)}</time>
    </button>
  );
}
```

### 3. Notifications page (optional)

Full list — filter reminders on client: `items.filter((n) => n.type === 'REMINDER')`

### 4. Meeting detail — no extra API needed

Reminder backend se auto jati hai. Meeting detail par optional info:

```jsx
{meeting.status === 'SCHEDULED' && (
  <p className="text-sm text-muted">
    Participants receive an email and notification 1 hour before this meeting.
  </p>
)}
```

### 5. Settings — reminder preferences (optional)

User apni channels change kar sakta hai (email on/off):

```
GET /api/users/me
→ reminderPreference: { channels: ['EMAIL','IN_APP'], lead_times: [60] }

PATCH /api/users/me/reminder-preferences
{
  "channels": ["EMAIL", "IN_APP"],
  "lead_times": [60]
}
```

**Note:** System ab **1 hour** use karta hai (`MEETING_REMINDER_LEAD_MINUTES`). `lead_times` field future ke liye hai — abhi `[60]` rakho.

---

## Email (automatic — no frontend)

Participants ko email jati hai:

- **Subject:** `Reminder: {meeting title} in 1 hour`
- **Body:** Gov-style template (green header, meeting details, View Meeting button)
- **Link:** `{CLIENT_BASE_URL}/meetings/{id}`

Frontend ko email ke liye kuch nahi karna.

---

## API helper (copy-paste)

```javascript
// api/notifications.js
import api from './axios';

export const listNotifications = (params) => api.get('/notifications', { params });
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.patch('/notifications/read-all');
```

```javascript
// hooks/useNotifications.js (example)
import { useEffect, useState } from 'react';
import { listNotifications } from '../api/notifications';

export function useNotifications(pollMs = 60000) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const refresh = async () => {
    const { data } = await listNotifications({ limit: 20 });
    const list = data.data || [];
    setItems(list);
    setUnread(list.filter((n) => !n.is_read).length);
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [pollMs]);

  return { items, unread, refresh };
}
```

---

## Testing

### Quick test (meeting 65 min from now)

1. Create meeting starting **65 minutes** from now
2. Add yourself as participant
3. Wait ~5 minutes (cron runs every minute)
4. Check:
   - `GET /api/notifications?unreadOnly=true`
   - Email inbox / YOPmail

### Manual DB check

```sql
SELECT * FROM reminders
WHERE meeting_id = YOUR_MEETING_ID
AND status = 'PENDING';
```

`remind_at` should be `start_time - 1 hour`.

### Env required for email

```env
EMAIL_ENABLED=true
```

Agar email off hai to sirf **in-app notification** jayegi.

---

## Notification types reference

| type | When |
|------|------|
| `REMINDER` | 1 hour before meeting |
| `INVITE` | Meeting invite |
| `CANCELLATION` | Meeting cancelled |
| `RESCHEDULE` | Meeting rescheduled |
| `NOTE_ADDED` | Official note added |

---

## Summary for frontend team

| Task | Required? |
|------|-----------|
| Notification bell + unread badge | **Yes** |
| Click REMINDER → open meeting | **Yes** |
| Mark as read | Recommended |
| Poll `/api/notifications` every 60s | Recommended |
| Email UI | **No** (backend automatic) |
| Schedule reminders from frontend | **No** (backend automatic) |
| Settings for channels | Optional |

---

## Related server files

- `src/services/reminderService.js` — scheduling + dispatch
- `src/workers/reminderWorker.js` — cron every minute
- `src/services/emailTemplates/meetingNotificationEmails.js` — email template
- `src/config/index.js` — `MEETING_REMINDER_LEAD_MINUTES`
