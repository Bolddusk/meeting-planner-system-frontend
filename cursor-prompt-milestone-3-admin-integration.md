# Milestone 3 — Admin Panel Integration Guide

Use this document to wire the **Meetings**, **Calendar**, and **Rooms** pages in the admin panel frontend.

**Base URL:** `http://localhost:5000/api`  
**Auth header:** `Authorization: Bearer <accessToken>`

---

## What's new in Milestone 3

| Feature | Status |
|---------|--------|
| Meeting rooms CRUD (list + create) | ✅ |
| Meetings CRUD (create, read, update, cancel) | ✅ |
| Participants + RSVP + check-in | ✅ |
| Conflict detection (room + required participants) | ✅ |
| Calendar + list views | ✅ |
| Audit log on create/update/cancel/rsvp | ✅ (backend only; audit UI in later milestone) |
| Recurring meetings (rrule) | ❌ Milestone 4 |
| Email notifications | ❌ Milestone 5 |
| Dedicated reschedule endpoint | ❌ Milestone 6 |
| ICS download | ❌ Milestone 8 |

---

## Run migrations & seed (if not done)

```powershell
cd server
npm run db:migrate
npx sequelize-cli db:seed --seed 20260103000001-seed-meeting-rooms.js
npx sequelize-cli db:seed --seed 20260103000002-seed-sample-meetings.js
```

**Seed data:**
- 4 meeting rooms (Board Room A, Conference Hall B, Virtual Zoom, Huddle Room C)
- 1 sample meeting: "Weekly Planning Meeting" (tomorrow 10:00–11:00 UTC)

---

## Response envelope (unchanged)

```json
{
  "success": true,
  "data": {},
  "meta": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 },
  "error": null
}
```

---

## 1. Rooms API

### GET `/api/rooms`
**Auth:** Required  
**Permission:** Any authenticated user

**Response `data`:**
```json
[
  {
    "id": 1,
    "name": "Board Room A",
    "capacity": 20,
    "location": "Floor 1 — East Wing",
    "is_virtual": false,
    "created_at": "2026-07-07T10:00:00.000Z"
  }
]
```

### POST `/api/rooms`
**Permission:** `room.manage` (ADMIN+)

**Request body:**
```json
{
  "name": "Meeting Room D",
  "capacity": 12,
  "location": "Floor 2",
  "is_virtual": false
}
```

---

## 2. Meetings — List & Calendar

### GET `/api/meetings`
**Auth:** Required

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `from` | ISO date | Start of date range filter |
| `to` | ISO date | End of date range filter |
| `status` | string | `SCHEDULED`, `RESCHEDULED`, `CANCELLED`, `COMPLETED`, `IN_PROGRESS` |
| `deptId` | number | Filter by department |
| `view` | string | `list` (default) or `calendar` |
| `page` | number | Page number (list view only) |
| `limit` | number | Items per page (list view, max 500) |
| `sort` | string | `start_time`, `title`, `created_at` |
| `order` | string | `asc` or `desc` |

**Role scoping (automatic on backend):**
- **ADMIN / SUPER_ADMIN** → all meetings
- **SECRETARY** → own department + meetings they participate in
- **USER** → only meetings where they are a participant

**Calendar view** (`view=calendar`) — use for FullCalendar:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Weekly Planning Meeting",
      "start": "2026-07-08T10:00:00.000Z",
      "end": "2026-07-08T11:00:00.000Z",
      "status": "SCHEDULED",
      "room": { "id": 1, "name": "Board Room A" },
      "organizer": { "id": 1, "full_name": "Super Admin" },
      "dept_id": 2
    }
  ],
  "meta": { "total": 1, "view": "calendar" }
}
```

**List view** (`view=list`) — use for meetings table:
```json
{
  "id": 1,
  "title": "Weekly Planning Meeting",
  "description": "...",
  "organizer": { "id": 1, "full_name": "Super Admin", "email": "..." },
  "room": { "id": 1, "name": "Board Room A", "location": "...", "capacity": 20, "is_virtual": false },
  "department": { "id": 2, "name": "Engineering" },
  "meeting_link": null,
  "start_time": "2026-07-08T10:00:00.000Z",
  "end_time": "2026-07-08T11:00:00.000Z",
  "status": "SCHEDULED",
  "is_recurring": false,
  "dept_id": 2,
  "agenda": ["Sprint review", "Blockers", "Next week goals"],
  "participants": [
    {
      "user_id": 1,
      "full_name": "Super Admin",
      "email": "superadmin@meetingplanner.local",
      "role": "ORGANIZER",
      "rsvp_status": "ACCEPTED",
      "attended": null,
      "check_in_at": null
    }
  ],
  "participant_count": 1,
  "created_by": { "id": 1, "full_name": "Super Admin", "email": "..." },
  "created_at": "...",
  "updated_at": "..."
}
```

**Frontend tip:** Send/receive all times in **UTC**. Convert to user timezone only for display.

---

## 3. Meeting — Detail

### GET `/api/meetings/:id`
**Auth:** Required (must be participant, secretary of dept, or admin)

Returns full meeting object (list view format).

---

## 4. Meeting — Create

### POST `/api/meetings`
**Permission:** `meeting.create` (SECRETARY+)

**Request body:**
```json
{
  "title": "Project Kickoff",
  "description": "Initial project discussion",
  "organizer_id": 1,
  "room_id": 1,
  "meeting_link": "https://zoom.us/j/123456",
  "start_time": "2026-07-10T14:00:00.000Z",
  "end_time": "2026-07-10T15:00:00.000Z",
  "dept_id": 2,
  "agenda": ["Introductions", "Scope", "Timeline"],
  "participants": [
    { "user_id": 2, "role": "REQUIRED" },
    { "user_id": 3, "role": "OPTIONAL" }
  ]
}
```

**Notes:**
- `organizer_id` optional — defaults to logged-in user
- Organizer is auto-added with role `ORGANIZER` and RSVP `ACCEPTED`
- `dept_id` required for SECRETARY (auto-set to their dept if omitted)
- Times must be ISO 8601 UTC strings

**Success:** `201` with full meeting in `data`

**Conflict error:** `409`
```json
{
  "success": false,
  "error": {
    "message": "Scheduling conflict detected",
    "details": {
      "room": {
        "meeting_id": 1,
        "title": "Existing Meeting",
        "start_time": "...",
        "end_time": "..."
      },
      "participants": [
        {
          "meeting_id": 2,
          "title": "Another Meeting",
          "user_id": 2,
          "start_time": "...",
          "end_time": "..."
        }
      ]
    }
  }
}
```

**Frontend:** Show conflict details in a modal — highlight conflicting room and/or participant names.

---

## 5. Meeting — Update

### PATCH `/api/meetings/:id`
**Permission:** `meeting.edit` (SECRETARY+ scoped to dept)

**Request body** (all fields optional, at least one required):
```json
{
  "title": "Updated Title",
  "start_time": "2026-07-10T15:00:00.000Z",
  "end_time": "2026-07-10T16:00:00.000Z",
  "room_id": 2,
  "participants": [
    { "user_id": 2, "role": "REQUIRED" }
  ]
}
```

**Behaviour:**
- If start/end time changes → status becomes `RESCHEDULED`, `original_start` saved
- Conflict check runs on every update
- Replacing `participants` array replaces all participants (organizer kept)

---

## 6. Meeting — Cancel

### DELETE `/api/meetings/:id`
**Permission:** `meeting.cancel`

**Response:**
```json
{
  "id": 1,
  "status": "CANCELLED",
  "message": "Meeting cancelled successfully"
}
```

Does not delete the row — sets `status = CANCELLED`.

---

## 7. RSVP

### POST `/api/meetings/:id/rsvp`
**Permission:** `rsvp.manage`  
**User must be a participant**

**Request body:**
```json
{ "status": "ACCEPTED" }
```
Allowed: `ACCEPTED`, `DECLINED`, `TENTATIVE`

---

## 8. Check-in

### POST `/api/meetings/:id/check-in`
**Permission:** `rsvp.manage`  
**User must be a participant**

**Response:**
```json
{
  "meeting_id": 1,
  "attended": true,
  "check_in_at": "2026-07-08T10:05:00.000Z"
}
```

---

## Permissions map for UI

| UI Action | Permission code | Roles |
|-----------|-----------------|-------|
| View meetings list/calendar | authenticated | All (scoped) |
| Create meeting | `meeting.create` | SUPER_ADMIN, ADMIN, SECRETARY |
| Edit meeting | `meeting.edit` | SUPER_ADMIN, ADMIN, SECRETARY (dept) |
| Cancel meeting | `meeting.cancel` | SUPER_ADMIN, ADMIN, SECRETARY (dept) |
| RSVP / check-in | `rsvp.manage` | All roles |
| List rooms | authenticated | All |
| Create room | `room.manage` | SUPER_ADMIN, ADMIN |

---

## Admin panel pages to build/update

### Meetings page (`/meetings`)
- Fetch: `GET /api/meetings?view=list&from=&to=&status=`
- Table columns: title, start_time, end_time, organizer, room, status, participants count
- Filters: date range, status, department
- Actions: View, Edit (if `meeting.edit`), Cancel (if `meeting.cancel`)
- "New Meeting" button if `meeting.create`

### Calendar page (`/calendar`)
- Fetch: `GET /api/meetings?view=calendar&from=<monthStart>&to=<monthEnd>`
- Map to FullCalendar events:
  ```js
  events = data.map(m => ({
    id: m.id,
    title: m.title,
    start: m.start,
    end: m.end,
    backgroundColor: statusColors[m.status],
    extendedProps: { status: m.status, room: m.room?.name }
  }))
  ```
- Click event → navigate to `/meetings/:id`

### Meeting create/edit modal
- Load rooms: `GET /api/rooms`
- Load users for participant picker: `GET /api/users`
- Load departments (from users/me dept or hardcode from API when available)
- Submit: `POST /api/meetings` or `PATCH /api/meetings/:id`
- Handle 409 conflict → show error modal with details

### Meeting detail (`/meetings/:id`)
- Fetch: `GET /api/meetings/:id`
- Show: title, time, room, link, agenda, participants + RSVP badges
- RSVP buttons if current user is participant: `POST /api/meetings/:id/rsvp`
- Edit / Cancel buttons if permitted

### Rooms page (`/rooms`) — ADMIN+
- List: `GET /api/rooms`
- Create form: `POST /api/rooms`

---

## Axios API helpers (suggested)

```javascript
// client/src/api/meetings.js
import api from './axios';

export const getMeetings = (params) =>
  api.get('/meetings', { params });

export const getMeeting = (id) =>
  api.get(`/meetings/${id}`);

export const createMeeting = (data) =>
  api.post('/meetings', data);

export const updateMeeting = (id, data) =>
  api.patch(`/meetings/${id}`, data);

export const cancelMeeting = (id) =>
  api.delete(`/meetings/${id}`);

export const rsvpMeeting = (id, status) =>
  api.post(`/meetings/${id}/rsvp`, { status });

export const checkInMeeting = (id) =>
  api.post(`/meetings/${id}/check-in`);
```

```javascript
// client/src/api/rooms.js
import api from './axios';

export const getRooms = () => api.get('/rooms');
export const createRoom = (data) => api.post('/rooms', data);
```

---

## Status badge colors (suggested)

| Status | Color |
|--------|-------|
| `SCHEDULED` | blue |
| `RESCHEDULED` | orange |
| `IN_PROGRESS` | green |
| `COMPLETED` | gray |
| `CANCELLED` | red |

---

## RSVP badge colors (suggested)

| RSVP | Color |
|------|-------|
| `PENDING` | yellow |
| `ACCEPTED` | green |
| `DECLINED` | red |
| `TENTATIVE` | orange |

---

## Not yet available — do NOT wire yet

| Endpoint | Coming in |
|----------|-----------|
| `POST /api/meetings/:id/reschedule` | Milestone 6 |
| `GET /api/meetings/:id/invite.ics` | Milestone 8 |
| `GET /api/audit-log` | Milestone 6+ |
| `GET /api/notifications` | Milestone 5 |
| `GET /api/reports/summary` | Milestone 8 |
| Recurrence / RRULE in POST body | Milestone 4 |

---

## Quick test (curl)

```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@meetingplanner.local","password":"SuperAdmin@123"}'

# List meetings (replace TOKEN)
curl http://localhost:5000/api/meetings?view=list \
  -H "Authorization: Bearer TOKEN"

# List rooms
curl http://localhost:5000/api/rooms \
  -H "Authorization: Bearer TOKEN"
```

---

## Changelog from Milestone 2

| Added | Description |
|-------|-------------|
| `GET/POST /api/rooms` | Room management |
| `GET/POST/PATCH/DELETE /api/meetings` | Full meeting CRUD |
| `POST /api/meetings/:id/rsvp` | Participant RSVP |
| `POST /api/meetings/:id/check-in` | Attendance check-in |
| DB tables | `meeting_rooms`, `meetings`, `meeting_participants`, `meeting_audit_log` |
| Conflict detection | 409 on room or required participant overlap |

No changes to auth or user APIs from Milestone 2.
