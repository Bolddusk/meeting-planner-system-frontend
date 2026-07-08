# Milestone 8 — ICS Invites, Exports & Reports (Admin Panel Integration)

Wire **ICS download**, **Exports & Reports page**, and **dashboard stats**. Requires Milestones 3–7.

**Base URL:** `http://localhost:5000/api`

---

## What's new in Milestone 8

| Feature | Status |
|---------|--------|
| `GET /api/meetings/:id/invite.ics` | ✅ |
| `POST /api/exports` (async jobs) | ✅ |
| `GET /api/exports/:id` (poll status) | ✅ |
| `GET /api/exports/:id/download?token=` | ✅ signed URL, 24h expiry |
| `GET /api/reports/summary` | ✅ |
| Meeting log export (PDF + CSV) | ✅ |
| Reports export (PDF + XLSX) | ✅ |
| Dashboard stats cards | ✅ ADMIN+ / SECRETARY |

---

## Run migration

```powershell
cd server
npm run db:migrate
npm run dev
```

---

## 1. Download ICS invite (single meeting)

### GET `/api/meetings/:id/invite.ics`

**Permission:** `export.ics`

**Access rules:**
| Role | Access |
|------|--------|
| SUPER_ADMIN / ADMIN | any meeting |
| SECRETARY | meetings in own department |
| USER | only meetings where they are a participant |

**Response:** `text/calendar` file download (`.ics`)

**Frontend:** Add "Download ICS" button on meeting detail page.

```javascript
// client/src/api/meetings.js
export const downloadMeetingIcs = async (meetingId) => {
  const response = await api.get(`/meetings/${meetingId}/invite.ics`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `meeting-${meetingId}.ics`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};
```

**Recurring meetings:** ICS includes `RRULE` when the meeting is part of a series.

---

## 2. Async export jobs

### POST `/api/exports`

**Auth:** Required

**Permissions by export type:**

| export_type | Permission | Formats |
|-------------|------------|---------|
| `ICS_INVITE` | `export.ics` | `ICS` |
| `MEETING_LOG` | `export.meeting_log` | `PDF`, `CSV` |
| `REPORT` | `export.report` | `PDF`, `XLSX` |

**Request body:**
```json
{
  "export_type": "MEETING_LOG",
  "format": "PDF",
  "filters": {
    "from": "2026-07-01T00:00:00.000Z",
    "to": "2026-07-31T23:59:59.000Z",
    "deptId": 1,
    "meetingId": 5
  }
}
```

**Notes:**
- `filters.meetingId` — **required** for `ICS_INVITE`
- `filters.from` / `filters.to` — optional date range for logs & reports
- `filters.deptId` — optional department filter (ADMIN+; SECRETARY auto-scoped to own dept)

**Response (202):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "export_type": "MEETING_LOG",
    "format": "PDF",
    "filters": { "from": "...", "to": "..." },
    "status": "QUEUED",
    "error_message": null,
    "expires_at": "2026-07-08T12:00:00.000Z",
    "created_at": "2026-07-07T12:00:00.000Z"
  }
}
```

### GET `/api/exports/:id`

Poll until `status` is `READY` or `FAILED`.

**Status values:** `QUEUED` → `PROCESSING` → `READY` | `FAILED`

**When READY:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "READY",
    "download_url": "http://localhost:5000/api/exports/1/download?token=...&expires=...",
    "expires_at": "2026-07-08T12:00:00.000Z"
  }
}
```

### GET `/api/exports/:id/download?token=&expires=`

**Auth:** Not required (signed token URL)

Opens file download. Token expires after 24 hours.

---

## 3. Reports summary (dashboard)

### GET `/api/reports/summary`

**Permission:** `export.report`

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `from` | ISO date | Period start |
| `to` | ISO date | Period end |
| `deptId` | number | Optional department filter |

**Response:**
```json
{
  "success": true,
  "data": {
    "period": { "from": "2026-07-01T00:00:00.000Z", "to": "2026-07-31T23:59:59.000Z" },
    "meetings": {
      "total": 42,
      "upcoming": 12,
      "completed": 25,
      "cancelled": 5
    },
    "attendance": {
      "rate": 78,
      "rsvp_accept_rate": 85,
      "total_participant_slots": 120
    },
    "action_items": {
      "open": 8,
      "done": 22,
      "completion_rate": 73
    },
    "room_utilization_percent": 65,
    "meetings_by_department": [
      { "department": "Engineering", "count": 20 }
    ],
    "meetings_by_room": [
      { "room": "Conference Room A", "count": 15 }
    ]
  }
}
```

**Frontend:** Show stats cards on Dashboard for users with `export.report` permission.

---

## 4. Exports & Reports page (new)

**Route:** `/exports` (or `/reports`)

**Permission gate:** show page if user has any of `export.meeting_log`, `export.report`, `export.ics`

### UI layout

```
┌─────────────────────────────────────────────────┐
│  Exports & Reports                              │
├─────────────────────────────────────────────────┤
│  Export type: [Meeting Log ▼]                 │
│  Format:      [PDF ▼]                           │
│  From: [date]  To: [date]  Dept: [optional ▼] │
│  [Request Export]                               │
├─────────────────────────────────────────────────┤
│  Recent exports                                 │
│  ID | Type | Format | Status | Created | Action │
│  3  | REPORT | XLSX | READY | ... | [Download]  │
│  2  | MEETING_LOG | PDF | PROCESSING | ... | —  │
└─────────────────────────────────────────────────┘
```

### Polling pattern

```javascript
// client/src/api/exports.js
import api from './axios';

export const createExport = (data) => api.post('/exports', data);

export const getExport = (id) => api.get(`/exports/${id}`);

export const pollExportUntilReady = async (id, { intervalMs = 2000, maxAttempts = 30 } = {}) => {
  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await getExport(id);
    const job = data.data;
    if (job.status === 'READY') return job;
    if (job.status === 'FAILED') throw new Error(job.error_message || 'Export failed');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Export timed out');
};

// Usage
const { data } = await createExport({
  export_type: 'REPORT',
  format: 'XLSX',
  filters: { from: '2026-07-01', to: '2026-07-31' },
});
const job = await pollExportUntilReady(data.data.id);
window.open(job.download_url, '_blank');
```

---

## 5. Axios helpers

```javascript
// client/src/api/exports.js
import api from './axios';

export const createExport = (data) => api.post('/exports', data);
export const getExport = (id) => api.get(`/exports/${id}`);

// client/src/api/reports.js
export const getReportSummary = (params) =>
  api.get('/reports/summary', { params });
```

---

## 6. Permission map

| UI Element | Permission |
|------------|------------|
| Download ICS (meeting detail) | `export.ics` |
| Request meeting log export | `export.meeting_log` |
| Request report export | `export.report` |
| Dashboard stats cards | `export.report` |
| Exports page — meeting log section | `export.meeting_log` |
| Exports page — report section | `export.report` |

```javascript
const canExportIcs = permissions.includes('export.ics');
const canExportLog = permissions.includes('export.meeting_log');
const canExportReport = permissions.includes('export.report');
const showExportsPage = canExportLog || canExportReport || canExportIcs;
```

**USER role:** only `export.ics` (own meetings) — hide Exports page, show ICS button on meeting detail only.

---

## 7. Meeting detail — ICS button

Add next to RSVP / Reschedule buttons:

```jsx
{canExportIcs && (
  <button onClick={() => downloadMeetingIcs(meeting.id)}>
    Download ICS
  </button>
)}
```

---

## 8. Dashboard stats (ADMIN+ / SECRETARY)

If `canExportReport`, fetch summary on dashboard load:

```javascript
const { data } = await getReportSummary({
  from: startOfMonth.toISOString(),
  to: endOfMonth.toISOString(),
});
```

Show cards:
- Total meetings
- Attendance rate %
- Open action items
- Room utilization %

---

## 9. Build order

1. `api/exports.js` + `api/reports.js` helpers
2. ICS download button on meeting detail
3. Exports & Reports page (form + job list)
4. Poll + download flow for async exports
5. Dashboard stats cards (if `export.report`)
6. Sidebar nav link: "Exports" (role-gated)

---

## 10. Export content reference

| Type | PDF | CSV | XLSX | ICS |
|------|-----|-----|------|-----|
| Meeting log | ✅ full log with participants, notes, audit | ✅ tabular | — | — |
| Report | ✅ summary + attendance | — | ✅ multi-sheet workbook | — |
| ICS invite | — | — | — | ✅ single meeting |

**Report XLSX sheets:** Summary, By Department, By Room, Attendance by User

---

## Quick test

```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@meetingplanner.local","password":"SuperAdmin@123"}'

# Download ICS
curl -o invite.ics http://localhost:5000/api/meetings/1/invite.ics \
  -H "Authorization: Bearer TOKEN"

# Request meeting log export
curl -X POST http://localhost:5000/api/exports \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"export_type":"MEETING_LOG","format":"CSV","filters":{"from":"2026-01-01","to":"2026-12-31"}}'

# Poll export status
curl http://localhost:5000/api/exports/1 \
  -H "Authorization: Bearer TOKEN"

# Reports summary
curl "http://localhost:5000/api/reports/summary?from=2026-01-01&to=2026-12-31" \
  -H "Authorization: Bearer TOKEN"
```

---

## Frontend prompt order

| Done | File |
|------|------|
| ✅ | milestones 3–7 |
| **NEXT** | **milestone-8.md (this file)** |
| Last | Full React polish + tests (milestone 9–10) |

---

## Copy-paste message for frontend team

```
Milestone 8 backend is ready. Please integrate ICS download, Exports & Reports page, and dashboard stats.

Use the file: cursor-prompt-milestone-8-admin-integration.md

Key endpoints:
- GET /api/meetings/:id/invite.ics
- POST /api/exports → poll GET /api/exports/:id → download_url
- GET /api/reports/summary

Run server migration first: cd server && npm run db:migrate
```
