# Frontend Integration: API Gap Endpoints

> **Platform-specific guides:**
> - Mobile app → [`FRONTEND_API_GAPS_MOBILE.md`](./FRONTEND_API_GAPS_MOBILE.md)
> - Admin panel (web) → [`FRONTEND_API_GAPS_ADMIN.md`](./FRONTEND_API_GAPS_ADMIN.md)

New backend endpoints that replace polling, enable profile/password management, personal notes, reschedule status, and quality-of-life features.

**Base URL:** `http://localhost:5000/api` (or your `API_PUBLIC_URL`)

All authenticated routes require `Authorization: Bearer <accessToken>` unless noted.

---

## High priority

### 1. Push notifications (device registration)

Register FCM/APNs tokens so the server can push on `INVITE`, `REMINDER`, `RESCHEDULE`, `CANCELLATION`, and `RESCHEDULE_REQUEST`.

**Server env:**
```env
PUSH_ENABLED=true
FCM_SERVER_KEY=your-fcm-legacy-server-key
```

#### `POST /users/me/devices`

```json
{
  "token": "fcm-device-token-here",
  "platform": "ANDROID",
  "device_name": "Pixel 8"
}
```

`platform`: `IOS` | `ANDROID` | `WEB` (default `ANDROID`)

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "platform": "ANDROID",
    "device_name": "Pixel 8",
    "token": "fcm-device-token-here"
  }
}
```

Save `id` for unregistering by numeric id, or pass the raw `token` in the delete URL.

#### `DELETE /users/me/devices/:token`

`:token` may be the **device id** (numeric) or the **FCM token** (URL-encoded if it contains special characters).

**Response:**
```json
{ "success": true, "data": { "id": 1, "message": "Device unregistered" } }
```

**Frontend action:** Call `POST` on login / app start when push permission is granted. Call `DELETE` on logout. You can remove the 45s notification polling once push is wired — keep polling as fallback if `PUSH_ENABLED` is false on the server.

---

### 2. Edit profile

#### `PATCH /users/me`

```json
{
  "full_name": "Jane Doe",
  "phone": "+92 300 1234567",
  "timezone": "Asia/Karachi"
}
```

All fields optional; send at least one. Returns full `GET /users/me` shape including `calendar_feed_url`.

---

### 3. Password management

#### `PATCH /users/me/password` (authenticated)

```json
{
  "current_password": "OldPass@123",
  "new_password": "NewPass@456"
}
```

#### `POST /auth/forgot-password` (public)

```json
{ "email": "user@example.com" }
```

Always returns the same message (no email enumeration):
```json
{ "success": true, "data": { "message": "If that email exists, a reset link has been sent" } }
```

**Server env:**
```env
PASSWORD_RESET_URL_BASE=http://localhost:5173/reset-password
PASSWORD_RESET_TTL_MINUTES=60
EMAIL_ENABLED=true
```

Reset link format: `{PASSWORD_RESET_URL_BASE}?token=<raw-token>`

#### `POST /auth/reset-password` (public)

```json
{
  "token": "raw-token-from-email-link",
  "new_password": "NewPass@456"
}
```

Invalidates all refresh tokens for that user on success.

---

## Medium priority

### 4. Personal meeting notes

Requires permission `note.personal.edit`.

#### `GET /meetings/:id/note`

```json
{
  "success": true,
  "data": {
    "note": {
      "id": 12,
      "note_type": "PERSONAL",
      "content": "My private prep notes",
      "is_private": true,
      "author": { "id": 3, "full_name": "Jane", "email": "jane@example.com" }
    }
  }
}
```

`note` is `null` if none exists yet.

#### `PUT /meetings/:id/note`

```json
{
  "content": "Updated personal notes",
  "is_private": true
}
```

Creates or updates the current user's `PERSONAL` note for that meeting.

---

### 5. Reschedule request status

`POST /meetings/:id/reschedule-request` now persists requests and returns:

```json
{
  "success": true,
  "data": {
    "meeting_id": 42,
    "request_id": 7,
    "status": "PENDING",
    "message": "Reschedule request sent to the organizer"
  }
}
```

#### `GET /meetings/:id/reschedule-requests/mine`

Current user's latest request for this meeting:

```json
{
  "success": true,
  "data": {
    "request": {
      "id": 7,
      "meeting_id": 42,
      "status": "PENDING",
      "message": "Can we move to Thursday?",
      "proposed_start_time": "2026-07-10T10:00:00.000Z",
      "proposed_end_time": "2026-07-10T11:00:00.000Z",
      "requester": { "id": 3, "full_name": "Jane", "email": "jane@example.com" },
      "created_at": "...",
      "resolved_at": null
    }
  }
}
```

`request` is `null` if never requested. Status values: `PENDING` | `APPROVED` | `REJECTED` | `CANCELLED`.

When the organizer reschedules the meeting, pending requests are marked `APPROVED`.

#### `GET /meetings/:id/reschedule-requests`

Organizer (or admin) only — list of all requests for the meeting.

**UI suggestion:** Show a "Reschedule requested" badge when `request?.status === 'PENDING'`.

---

### 6. Avatar upload

#### `POST /users/me/avatar`

```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

Max 2 MB decoded. Returns:
```json
{ "success": true, "data": { "avatar_url": "http://localhost:5000/api/users/me/avatar" } }
```

#### `GET /users/me/avatar`

Returns the image binary (authenticated). Use as `img src` with Bearer token or after upload refresh `GET /users/me`.

**Server env:**
```env
AVATAR_STORAGE_PATH=./storage/avatars
API_PUBLIC_URL=http://localhost:5000
```

---

## Nice to have

### 7. Personal calendar feed (iCal subscription)

`GET /users/me` includes `calendar_feed_url` — a signed URL valid for 1 year.

Example:
```
GET /users/me/calendar.ics?uid=3&token=abc...&expires=2027-07-09T...
```

**No Bearer token required** — the `token` + `expires` + `uid` query params authenticate the feed.

Returns `text/calendar` with up to 200 upcoming meetings where the user is a participant.

**Server env:**
```env
CALENDAR_TOKEN_SECRET=long-random-secret
```

---

### 8. Unread notification count

#### `GET /notifications/unread-count`

```json
{ "success": true, "data": { "unread_count": 5 } }
```

Use for the notification bell badge instead of `GET /notifications?unreadOnly=true&limit=1`.

---

### 9. Notification delete / clear-all

#### `DELETE /notifications/:id`

Delete a single notification.

#### `DELETE /notifications`

Clear all notifications for the current user.

```json
{ "success": true, "data": { "deleted": 12 } }
```

---

### 10. Meeting text search

#### `GET /meetings?search=budget`

Filters meetings by `title` or `description` (case-insensitive partial match). Works with existing filters (`status`, `from`, `to`, `deptId`, etc.).

---

## `GET /users/me` — updated response

```json
{
  "success": true,
  "data": {
    "id": 3,
    "email": "user@example.com",
    "full_name": "Jane Doe",
    "phone": "+92 300 1234567",
    "timezone": "Asia/Karachi",
    "avatar_url": null,
    "is_active": true,
    "roles": [...],
    "permissions": [...],
    "reminderPreference": {
      "channels": ["EMAIL", "IN_APP"],
      "lead_times": [60]
    },
    "calendar_feed_url": "http://localhost:5000/api/users/me/calendar.ics?uid=3&token=...&expires=..."
  }
}
```

---

## Live deploy

Run migrations:
```bash
npx sequelize-cli db:migrate
```

New tables: `user_devices`, `password_reset_tokens`, `meeting_reschedule_requests`.

Optional env vars (see sections above):
```env
PUSH_ENABLED=true
FCM_SERVER_KEY=
CALENDAR_TOKEN_SECRET=
PASSWORD_RESET_URL_BASE=
AVATAR_STORAGE_PATH=./storage/avatars
API_PUBLIC_URL=
```

---

## Quick endpoint summary

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/users/me/devices` | Yes | Register push token |
| DELETE | `/users/me/devices/:token` | Yes | Unregister device |
| PATCH | `/users/me` | Yes | Edit profile |
| PATCH | `/users/me/password` | Yes | Change password |
| POST | `/users/me/avatar` | Yes | Upload avatar |
| GET | `/users/me/avatar` | Yes | Fetch avatar image |
| GET | `/users/me/calendar.ics` | Token query | iCal subscription |
| POST | `/auth/forgot-password` | No | Request reset email |
| POST | `/auth/reset-password` | No | Complete reset |
| GET | `/meetings/:id/note` | Yes | Get personal note |
| PUT | `/meetings/:id/note` | Yes + perm | Upsert personal note |
| GET | `/meetings/:id/reschedule-requests/mine` | Yes | My reschedule status |
| GET | `/meetings/:id/reschedule-requests` | Organizer | All requests |
| GET | `/notifications/unread-count` | Yes | Badge count |
| DELETE | `/notifications/:id` | Yes | Delete one |
| DELETE | `/notifications` | Yes | Clear all |
| GET | `/meetings?search=` | Yes | Text search |
