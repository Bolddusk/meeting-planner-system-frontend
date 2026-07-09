# Admin Panel Integration: New APIs

Yeh guide **web admin panel** (React / gov-themed UI on `localhost:5173`) ke liye hai — Settings, Meetings, Notifications, aur Login screens.

**Base URL:** `http://localhost:5000/api`

**Auth:** `Authorization: Bearer <accessToken>` (public routes ke ilawa)

> **Note:** Push device registration (`/users/me/devices`) admin panel ke liye **optional** hai. Woh mainly mobile app ke liye hai. Baaki sab APIs yahan integrate honi chahiye.

---

## Screen → API map

| Screen | APIs |
|--------|------|
| Login | `POST /auth/forgot-password` |
| Reset Password page (`/reset-password`) | `POST /auth/reset-password` |
| Settings — Profile | `GET /users/me`, `PATCH /users/me` |
| Settings — Avatar | `POST /users/me/avatar`, `GET /users/me/avatar` |
| Settings — Password | `PATCH /users/me/password` |
| Settings — Reminder prefs | `PATCH /users/me/reminder-preferences` (existing) |
| Settings — Calendar | `calendar_feed_url` from `GET /users/me` |
| Header — Notification bell | `GET /notifications/unread-count` |
| Notifications drawer/page | `GET /notifications`, `DELETE /notifications/:id`, `DELETE /notifications` |
| Meetings list | `GET /meetings?search=` |
| Meeting detail — participant | `GET/PUT /meetings/:id/note`, `GET .../reschedule-requests/mine` |
| Meeting detail — organizer | `GET /meetings/:id/reschedule-requests` |

---

## 1. Settings — Profile (read + edit)

Abhi Settings sirf **read** karti thi (`GET /users/me`). Ab edit bhi ho sakti hai.

### `GET /users/me`

Page load par:

```json
{
  "id": 3,
  "email": "user@example.com",
  "full_name": "Ahmed Khan",
  "phone": "+92 300 1234567",
  "timezone": "Asia/Karachi",
  "avatar_url": null,
  "roles": [...],
  "permissions": [...],
  "reminderPreference": {
    "channels": ["EMAIL", "IN_APP"],
    "lead_times": [60]
  },
  "calendar_feed_url": "http://localhost:5000/api/users/me/calendar.ics?uid=3&token=...&expires=..."
}
```

### `PATCH /users/me`

Save button par:

```json
{
  "full_name": "Ahmed Khan",
  "phone": "+92 300 1234567",
  "timezone": "Asia/Karachi"
}
```

**UI fields:**

| Field | Input type |
|-------|------------|
| `full_name` | Text input |
| `phone` | Tel input (optional) |
| `timezone` | Dropdown (`Asia/Karachi`, `UTC`, etc.) |
| `email` | Read-only (change nahi hota) |

Success → form refresh with response data.

---

## 2. Settings — Avatar

### `POST /users/me/avatar`

File picker → FileReader → base64 data URL:

```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

Max **2 MB**. Response:
```json
{ "avatar_url": "http://localhost:5000/api/users/me/avatar" }
```

### `GET /users/me/avatar`

Header / sidebar profile image:

```jsx
// Option A: fetch with Bearer and blob URL
const res = await fetch(avatar_url, { headers: { Authorization: `Bearer ${token}` } });
const blob = await res.blob();
img.src = URL.createObjectURL(blob);

// Option B: upload ke baad GET /users/me refresh
```

---

## 3. Settings — Change password

### `PATCH /users/me/password`

Settings tab "Security" ya "Password":

```json
{
  "current_password": "OldPass@123",
  "new_password": "NewPass@456"
}
```

**UI:**
- Current password
- New password
- Confirm new password (frontend validation)
- Success toast → optional logout

---

## 4. Login — Forgot / Reset password

### Forgot — `POST /auth/forgot-password` (no auth)

Login page par "Forgot password?" link:

```json
{ "email": "user@example.com" }
```

Response (hamesha same — email leak nahi):
```json
{ "message": "If that email exists, a reset link has been sent" }
```

**Server env:**
```env
PASSWORD_RESET_URL_BASE=http://localhost:5173/reset-password
PASSWORD_RESET_TTL_MINUTES=60
EMAIL_ENABLED=true
```

### Reset — `POST /auth/reset-password` (no auth)

Route: `/reset-password?token=...`

```json
{
  "token": "token-from-url-query",
  "new_password": "NewPass@456"
}
```

Success → redirect to `/login` with message.

Invalid/expired token → error message + link back to forgot password.

---

## 5. Settings — Calendar subscription

`GET /users/me` → `calendar_feed_url`

**UI:** Settings mein "Subscribe to calendar" section:

```html
<input readonly value={calendar_feed_url} />
<button onClick={copyToClipboard}>Copy link</button>
<a href={calendar_feed_url}>Open in Outlook / Google Calendar</a>
```

User yeh URL apne calendar app mein add karega — meetings auto-sync hongi.

Feed URL **1 year** valid hai. Expire hone par `GET /users/me` dubara call karein fresh URL ke liye.

---

## 6. Header — Notification badge

### `GET /notifications/unread-count`

```json
{ "unread_count": 5 }
```

**Replace current approach:**
```
❌ GET /notifications?unreadOnly=true&limit=1  (heavy)
✅ GET /notifications/unread-count               (lightweight)
```

Bell icon par number dikhao. Poll interval 30–60s rakho (web par push optional hai).

### Notifications panel

| Action | API |
|--------|-----|
| Load list | `GET /notifications` (existing) |
| Mark read | `PATCH /notifications/:id/read` (existing) |
| Mark all read | `PATCH /notifications/read-all` (existing) |
| Delete one | `DELETE /notifications/:id` |
| Clear all | `DELETE /notifications` |

**Clear all response:**
```json
{ "deleted": 12 }
```

Confirm dialog before clear all.

---

## 7. Meetings list — Search

### `GET /meetings?search=budget`

Meetings table / calendar view ke upar search bar:

```
GET /meetings?search=quarterly&status=SCHEDULED&page=1&limit=20
```

Searches `title` + `description` (case-insensitive, partial match).

**UI:**
- Debounced input (~300ms)
- Clear (×) button
- Empty state: "No meetings match your search"

Works with existing filters: `status`, `from`, `to`, `deptId`, `view=calendar|list`.

---

## 8. Meeting detail — Personal notes

Permission: `note.personal.edit` (USER role ke paas already hai)

### `GET /meetings/:id/note`

Meeting detail page load par — alag "My Notes" panel:

```json
{
  "note": {
    "id": 12,
    "note_type": "PERSONAL",
    "content": "Private prep notes",
    "is_private": true,
    "author": { "id": 3, "full_name": "Ahmed", "email": "..." }
  }
}
```

`note: null` → empty textarea dikhao.

### `PUT /meetings/:id/note`

```json
{
  "content": "Budget slide #4 highlight karna",
  "is_private": true
}
```

**UI placement:** Shared notes (MINUTES / DECISIONS) se **alag** section — sirf current user ko dikhe.

```
┌─────────────────────────────────────┐
│ Meeting: Quarterly Review           │
├─────────────────────────────────────┤
│ Shared Notes (existing)             │
│   Minutes, Decisions, Actions       │
├─────────────────────────────────────┤
│ 📝 My Personal Notes    [Save]      │
│ ┌─────────────────────────────────┐ │
│ │ (private textarea)              │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## 9. Meeting detail — Reschedule requests

### Participant view — `GET /meetings/:id/reschedule-requests/mine`

Jab user ne `POST /reschedule-request` kiya ho:

```json
{
  "request": {
    "id": 7,
    "status": "PENDING",
    "message": "Can we move to Thursday?",
    "proposed_start_time": "2026-07-10T10:00:00.000Z",
    "proposed_end_time": "2026-07-10T11:00:00.000Z",
    "created_at": "...",
    "resolved_at": null
  }
}
```

**Status badges on meeting card / detail:**

| Status | Badge text | Color |
|--------|------------|-------|
| `PENDING` | Reschedule requested | Amber |
| `APPROVED` | Reschedule approved | Green |
| `REJECTED` | Reschedule declined | Red |
| `CANCELLED` | Request cancelled | Gray |

### Organizer / Admin view — `GET /meetings/:id/reschedule-requests`

Sirf **organizer** ya **admin** ke liye. Meeting detail par requests table:

```json
[
  {
    "id": 7,
    "status": "PENDING",
    "message": "Can we move to Thursday?",
    "proposed_start_time": "...",
    "proposed_end_time": "...",
    "requester": { "id": 3, "full_name": "Ahmed", "email": "..." },
    "created_at": "...",
    "resolved_at": null
  }
]
```

**UI:** Organizer ko pending requests dikhao → "Reschedule meeting" action se approve (existing `POST /meetings/:id/reschedule` — pending requests auto `APPROVED` mark hoti hain).

### Updated `POST /reschedule-request` response

```json
{
  "meeting_id": 42,
  "request_id": 7,
  "status": "PENDING",
  "message": "Reschedule request sent to the organizer"
}
```

Request modal success par `request_id` save karo ya page refresh par `.../mine` call karo.

---

## 10. Push notifications (optional on web)

Admin panel ke liye **zaroori nahi**. Agar future mein web push chahiye:

```
POST /users/me/devices
{ "token": "...", "platform": "WEB" }
```

Mobile guide mein full push flow hai → `FRONTEND_API_GAPS_MOBILE.md`

---

## Admin panel integration checklist

```
[ ] Settings: editable profile (PATCH /users/me)
[ ] Settings: avatar upload + display
[ ] Settings: change password form
[ ] Settings: calendar_feed_url copy button
[ ] Login: "Forgot password?" → POST /auth/forgot-password
[ ] /reset-password page → POST /auth/reset-password
[ ] Header bell: GET /notifications/unread-count
[ ] Notifications: delete single + clear all
[ ] Meetings list: search bar (?search=)
[ ] Meeting detail: "My Notes" panel (GET/PUT /note)
[ ] Meeting detail: reschedule status badge (participant)
[ ] Meeting detail: reschedule requests table (organizer)
```

---

## API quick reference (admin)

| Method | Path | Screen |
|--------|------|--------|
| PATCH | `/users/me` | Settings — Profile |
| PATCH | `/users/me/password` | Settings — Security |
| POST | `/users/me/avatar` | Settings — Profile photo |
| GET | `/users/me/avatar` | Header avatar |
| POST | `/auth/forgot-password` | Login |
| POST | `/auth/reset-password` | Reset page |
| GET | `/notifications/unread-count` | Header badge |
| DELETE | `/notifications/:id` | Notifications panel |
| DELETE | `/notifications` | Notifications — Clear all |
| GET | `/meetings?search=` | Meetings list |
| GET | `/meetings/:id/note` | Meeting detail |
| PUT | `/meetings/:id/note` | Meeting detail |
| GET | `/meetings/:id/reschedule-requests/mine` | Meeting detail (participant) |
| GET | `/meetings/:id/reschedule-requests` | Meeting detail (organizer) |

---

## Deploy (backend)

```bash
npx sequelize-cli db:migrate
```

```env
PASSWORD_RESET_URL_BASE=http://localhost:5173/reset-password
EMAIL_ENABLED=true
CALENDAR_TOKEN_SECRET=long-random-secret
AVATAR_STORAGE_PATH=./storage/avatars
API_PUBLIC_URL=http://localhost:5000
```

---

## Related docs

- Mobile app APIs → `FRONTEND_API_GAPS_MOBILE.md`
- Meeting reminders → `FRONTEND_MEETING_REMINDERS.md`
- Full API list → `FRONTEND_API_GAPS.md`
