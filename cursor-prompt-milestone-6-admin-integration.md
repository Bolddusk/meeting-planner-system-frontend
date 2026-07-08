# Milestone 6 — Reschedule & Audit Log (Admin Panel Integration)

Wire **reschedule** actions and **audit history** tab. Requires Milestones 3–5 to be complete.

**Base URL:** `http://localhost:5000/api`

---

## What's new in Milestone 6

| Feature | Status |
|---------|--------|
| `POST /api/meetings/:id/reschedule` | ✅ SECRETARY+ |
| `POST /api/meetings/:id/reschedule-request` | ✅ USER role |
| `GET /api/audit-log` | ✅ ADMIN+ |
| RESCHEDULE notifications + email | ✅ |
| Reminder cancel + regenerate on reschedule | ✅ |
| ICS attachment in reschedule email | ❌ Milestone 8 |
| Meeting notes UI | ❌ Milestone 7 |

---

## 1. Reschedule meeting (SECRETARY+)

### POST `/api/meetings/:id/reschedule`

**Permission:** `meeting.reschedule`

**Request body:**
```json
{
  "start_time": "2026-07-15T14:00:00.000Z",
  "end_time": "2026-07-15T15:00:00.000Z",
  "room_id": 2,
  "meeting_link": "https://zoom.us/j/123",
  "reason": "Room conflict resolved"
}
```

**Required:** `start_time`, `end_time`  
**Behaviour:**
- Status → `RESCHEDULED`
- `original_start` saved
- Conflict check runs
- Pending reminders cancelled + new ones scheduled
- RESCHEDULE notification + email to all participants
- Audit log entry written

**Response:** Full updated meeting object

---

## 2. Request reschedule (USER role)

### POST `/api/meetings/:id/reschedule-request`

**Permission:** `reschedule.request`  
**User must be a participant**

**Request body:**
```json
{
  "message": "Can we move this to afternoon? I have a conflict.",
  "proposed_start_time": "2026-07-15T14:00:00.000Z",
  "proposed_end_time": "2026-07-15T15:00:00.000Z"
}
```

**Required:** `message`  
**Behaviour:** Sends `RESCHEDULE_REQUEST` notification to organizer

**Response:**
```json
{
  "meeting_id": 1,
  "message": "Reschedule request sent to the organizer"
}
```

---

## 3. Audit log API (ADMIN+)

### GET `/api/audit-log`

**Permission:** `audit.view`

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `meetingId` | number | Filter by meeting |
| `from` | ISO date | Start date |
| `to` | ISO date | End date |
| `action` | string | CREATED, UPDATED, RESCHEDULED, CANCELLED, RSVP, etc. |
| `page`, `limit` | number | Pagination |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "meeting_id": 1,
      "action": "RESCHEDULED",
      "old_values": {
        "start_time": "2026-07-14T09:00:00.000Z",
        "end_time": "2026-07-14T10:00:00.000Z"
      },
      "new_values": {
        "start_time": "2026-07-15T14:00:00.000Z",
        "end_time": "2026-07-15T15:00:00.000Z",
        "status": "RESCHEDULED"
      },
      "actor": {
        "id": 1,
        "full_name": "Super Admin",
        "email": "superadmin@meetingplanner.local"
      },
      "meeting": { "id": 1, "title": "Weekly Planning" },
      "created_at": "2026-07-07T10:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

---

## 4. UI — Meeting detail page updates

### Reschedule button (SECRETARY+)

Show if user has `meeting.reschedule` permission:

```
[Reschedule]  → opens modal with:
  - New start date/time
  - New end date/time
  - Room (optional change)
  - Reason (optional)
  - [Cancel] [Confirm Reschedule]
```

On submit:
```javascript
POST /api/meetings/:id/reschedule
{ start_time, end_time, room_id, reason }
```

Handle `409` conflict same as create meeting.

### Request reschedule button (USER role only)

Show if user has `reschedule.request` but NOT `meeting.reschedule`:

```
[Request Reschedule]  → modal:
  - Message (required)
  - Proposed new time (optional)
  - [Send Request]
```

```javascript
POST /api/meetings/:id/reschedule-request
{ message, proposed_start_time, proposed_end_time }
```

### Audit History tab (ADMIN+)

Add tab on `/meetings/:id` — visible if `audit.view` permission:

```
GET /api/audit-log?meetingId=:id
```

**Table columns:**
| When | Actor | Action | Changes |
|------|-------|--------|---------|
| Jul 7, 10:00 | Super Admin | RESCHEDULED | start: Jul14 → Jul15 |
| Jul 6, 09:00 | Super Admin | CREATED | — |

**Action badge colors:**
| Action | Color |
|--------|-------|
| CREATED | green |
| UPDATED | blue |
| RESCHEDULED | orange |
| CANCELLED | red |
| RSVP | gray |

Show `old_values` → `new_values` as a simple diff (JSON or formatted fields).

---

## 5. Standalone Audit page (optional, ADMIN+)

Route: `/audit`

Full audit log with filters:
- Date range
- Meeting ID search
- Action type filter

```javascript
GET /api/audit-log?from=&to=&action=&page=1
```

Add to sidebar if `audit.view` permission.

---

## 6. Notification types — new in M6

| Type | Who receives | Trigger |
|------|-------------|---------|
| `RESCHEDULE` | All participants | Secretary+ reschedules |
| `RESCHEDULE_REQUEST` | Organizer | USER requests reschedule |

Update notification bell to handle these types (icons from M5 doc).

---

## 7. Axios helpers

```javascript
// client/src/api/meetings.js
export const rescheduleMeeting = (id, data) =>
  api.post(`/meetings/${id}/reschedule`, data);

export const requestReschedule = (id, data) =>
  api.post(`/meetings/${id}/reschedule-request`, data);

// client/src/api/audit.js
import api from './axios';

export const getAuditLog = (params) =>
  api.get('/audit-log', { params });
```

---

## 8. Permission map

| UI Element | Permission |
|------------|------------|
| Reschedule button | `meeting.reschedule` |
| Request reschedule button | `reschedule.request` (and NOT `meeting.reschedule`) |
| Audit tab / page | `audit.view` |

```javascript
const canReschedule = permissions.includes('meeting.reschedule');
const canRequest = permissions.includes('reschedule.request') && !canReschedule;
const canViewAudit = permissions.includes('audit.view');
```

---

## 9. Build order

1. `api/audit.js` + `rescheduleMeeting` / `requestReschedule` helpers
2. Reschedule modal on meeting detail (SECRETARY+)
3. Request reschedule modal (USER role)
4. Audit History tab on meeting detail (ADMIN+)
5. (Optional) `/audit` standalone page
6. Update notification bell for RESCHEDULE + RESCHEDULE_REQUEST types

---

## Not yet available

| Feature | Milestone |
|---------|-----------|
| Meeting notes tab | 7 |
| Action items tab | 7 |
| ICS download | 8 |
| Exports & Reports | 8 |
| `GET /api/reports/summary` | 8 |

---

## Quick test

```bash
# Reschedule (as superadmin)
curl -X POST http://localhost:5000/api/meetings/1/reschedule \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"start_time":"2026-07-15T14:00:00.000Z","end_time":"2026-07-15T15:00:00.000Z","reason":"Moved"}'

# Audit log
curl "http://localhost:5000/api/audit-log?meetingId=1" \
  -H "Authorization: Bearer TOKEN"
```

---

## Frontend prompt order

| Done | File |
|------|------|
| ✅ | admin-frontend.md |
| ✅ | milestone-3.md |
| ✅ | milestone-4.md |
| ✅ | milestone-5.md |
| **NOW** | **milestone-6.md (this file)** |
| Next | milestone-7.md (notes + action items) |
