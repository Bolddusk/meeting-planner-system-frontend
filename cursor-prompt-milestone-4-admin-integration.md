# Milestone 4 — Recurring Meetings (Admin Panel Integration)

Wire **recurring meeting** support in the admin panel. Requires Milestone 3 meetings pages to be working first.

**Base URL:** `http://localhost:5000/api`

---

## What's new in Milestone 4

| Feature | Status |
|---------|--------|
| Create recurring series with RRULE | ✅ |
| Auto-materialize occurrences (90 days ahead) | ✅ |
| Edit scope: `this` / `following` / `series` | ✅ |
| Cancel scope: `this` / `following` / `series` | ✅ |
| Skip cancelled dates via `exceptions` | ✅ |
| Nightly cron job (2 AM) + startup materialize | ✅ |
| Email reminders for series | ❌ Milestone 5 |
| ICS with RRULE | ❌ Milestone 8 |

---

## Run migration & seed

```powershell
cd server
npm run db:migrate
npx sequelize-cli db:seed --seed 20260104000001-seed-recurring-meeting.js
```

Restart server — occurrences auto-materialize on startup.

**Seed:** `Engineering Standup (Weekly)` — every Monday, 8 occurrences (`FREQ=WEEKLY;BYDAY=MO;COUNT=8`)

---

## RRULE format

Send RRULE **without** the `RRULE:` prefix in the API body:

```
FREQ=WEEKLY;BYDAY=MO;COUNT=12
FREQ=DAILY;INTERVAL=1;COUNT=30
FREQ=MONTHLY;BYMONTHDAY=15;COUNT=6
```

| UI option | RRULE |
|-----------|-------|
| Every day for 30 times | `FREQ=DAILY;COUNT=30` |
| Every week on Mon & Wed | `FREQ=WEEKLY;BYDAY=MO,WE;COUNT=20` |
| Every 2 weeks on Friday | `FREQ=WEEKLY;INTERVAL=2;BYDAY=FR;COUNT=10` |
| Monthly on 1st | `FREQ=MONTHLY;BYMONTHDAY=1;COUNT=12` |

**Permission required:** `meeting.recurrence.configure` (SECRETARY+)

---

## 1. Create recurring meeting

### POST `/api/meetings`

Same as Milestone 3, plus `rrule` field:

```json
{
  "title": "Weekly Team Sync",
  "description": "Recurring weekly meeting",
  "start_time": "2026-07-14T09:00:00.000Z",
  "end_time": "2026-07-14T10:00:00.000Z",
  "room_id": 1,
  "dept_id": 2,
  "participants": [
    { "user_id": 2, "role": "REQUIRED" }
  ],
  "rrule": "FREQ=WEEKLY;BYDAY=MO;COUNT=12"
}
```

**Behaviour:**
- Creates `recurrence_rules` row
- Creates **master** meeting at `start_time` (`is_recurring: true`, `parent_meeting_id: null`)
- Materializes child occurrences for next **90 days**
- Conflict check runs for **all** occurrences in range — returns `409` if any conflict

**Response** includes recurrence info:
```json
{
  "is_recurring": true,
  "recurrence_id": 1,
  "parent_meeting_id": null,
  "recurrence": {
    "id": 1,
    "rrule": "FREQ=WEEKLY;BYDAY=MO;COUNT=12",
    "start_date": "2026-07-14",
    "end_date": null,
    "exceptions": []
  }
}
```

Child occurrences have `parent_meeting_id` set to master id.

---

## 2. Recurrence builder UI (admin panel)

Add to meeting create/edit modal when "Repeat" toggle is ON:

```
┌─────────────────────────────────────┐
│  Repeat meeting          [ON/OFF]   │
│                                     │
│  Frequency:  [Daily ▼]              │
│  Every:      [1] week(s)            │
│  On:         ☑ Mon ☐ Tue ☐ Wed ... │
│                                     │
│  Ends:                              │
│  ○ After [12] occurrences           │
│  ○ On date [2026-12-31]             │
│                                     │
│  Preview: "Every Monday, 12 times"  │
└─────────────────────────────────────┘
```

Convert UI selections → RRULE string before POST:

```javascript
function buildRRule({ freq, interval, byDay, count, until }) {
  let rrule = `FREQ=${freq}`;
  if (interval > 1) rrule += `;INTERVAL=${interval}`;
  if (byDay?.length) rrule += `;BYDAY=${byDay.join(',')}`;
  if (count) rrule += `;COUNT=${count}`;
  if (until) rrule += `;UNTIL=${formatUntil(until)}`;
  return rrule;
}

// Example: weekly Monday, 12 times
// → "FREQ=WEEKLY;BYDAY=MO;COUNT=12"
```

---

## 3. Edit recurring meeting — scope dialog

When user edits a recurring occurrence, show modal:

```
┌──────────────────────────────────────────┐
│  Edit recurring meeting                  │
│                                          │
│  ○ This event only                       │
│  ○ This and following events             │
│  ○ All events in the series              │
│                                          │
│         [Cancel]  [Save]                 │
└──────────────────────────────────────────┘
```

### PATCH `/api/meetings/:id?scope=this|following|series`

| Scope | API call | Effect |
|-------|----------|--------|
| **this** | `?scope=this` | Edit only this occurrence |
| **following** | `?scope=following` | Split series from this date; old series gets exceptions; new series created |
| **series** | `?scope=series` | Update master + RRULE; delete & re-materialize future occurrences |

**Example — edit title for whole series:**
```
PATCH /api/meetings/5?scope=series
{ "title": "Updated Standup Name" }
```

**Example — change time for one occurrence only:**
```
PATCH /api/meetings/8?scope=this
{ "start_time": "2026-07-15T10:00:00.000Z", "end_time": "2026-07-15T11:00:00.000Z" }
```

---

## 4. Cancel recurring meeting — scope dialog

Same modal pattern for delete/cancel:

### DELETE `/api/meetings/:id?scope=this|following|series`

| Scope | Response message |
|-------|-----------------|
| **this** | `Occurrence cancelled successfully` — date added to `exceptions` |
| **following** | `This and following occurrences cancelled` |
| **series** | `Entire recurring series cancelled` |

**Example:**
```
DELETE /api/meetings/8?scope=this
```

---

## 5. Calendar display for recurring

Calendar fetches all materialized occurrences (not the RRULE directly):

```
GET /api/meetings?view=calendar&from=2026-07-01&to=2026-07-31
```

Each occurrence is a separate calendar event. Show recurring icon on events where `is_recurring: true`:

```javascript
events = data.map(m => ({
  id: m.id,
  title: m.is_recurring ? `🔁 ${m.title}` : m.title,
  start: m.start,
  end: m.end,
  extendedProps: {
    is_recurring: m.is_recurring,
    recurrence_id: m.recurrence_id,
    parent_meeting_id: m.parent_meeting_id,
  }
}));
```

---

## 6. Meeting detail — recurring info

On `/meetings/:id` show recurrence badge when `is_recurring`:

```
┌─────────────────────────────────────────┐
│  Weekly Team Sync          [RECURRING]  │
│  🔁 Every Monday · 12 occurrences       │
│  Jul 14, 2026 9:00 AM – 10:00 AM UTC   │
│                                         │
│  RRULE: FREQ=WEEKLY;BYDAY=MO;COUNT=12   │
│  Exceptions: 2026-08-04 (cancelled)      │
└─────────────────────────────────────────┘
```

Read from `data.recurrence`:
- `rrule` — show human-readable text
- `exceptions` — list of skipped dates

---

## 7. Updated meeting response fields

New fields on meeting object (list + detail):

| Field | Type | Description |
|-------|------|-------------|
| `is_recurring` | boolean | Part of a series |
| `recurrence_id` | number | FK to recurrence_rules |
| `parent_meeting_id` | number/null | null = series master |
| `original_start` | datetime/null | Set when single occurrence rescheduled |
| `recurrence` | object/null | `{ id, rrule, start_date, end_date, exceptions }` |

---

## 8. Axios helpers (add to meetings.js)

```javascript
export const createRecurringMeeting = (data) =>
  api.post('/meetings', { ...data, rrule: data.rrule });

export const updateMeetingScope = (id, data, scope = 'this') =>
  api.patch(`/meetings/${id}`, data, { params: { scope } });

export const cancelMeetingScope = (id, scope = 'this') =>
  api.delete(`/meetings/${id}`, { params: { scope } });
```

---

## 9. Scope modal component (suggested)

```jsx
function RecurrenceScopeModal({ open, action, onConfirm, onClose }) {
  const [scope, setScope] = useState('this');

  return (
    <Modal open={open} onClose={onClose}>
      <h3>{action === 'edit' ? 'Edit' : 'Cancel'} recurring meeting</h3>
      <Radio value="this"      label="This event only"           />
      <Radio value="following" label="This and following events" />
      <Radio value="series"    label="All events in the series"  />
      <Button onClick={() => onConfirm(scope)}>Confirm</Button>
    </Modal>
  );
}
```

Use before PATCH or DELETE when `meeting.is_recurring === true`.

---

## 10. Frontend build order (recommended)

Give Cursor **one prompt at a time** in this order:

| Step | Prompt file | What to build |
|------|-------------|---------------|
| 1 ✅ | `cursor-prompt-meeting-planner-admin-frontend.md` | Scaffold, Login, Layout, Auth |
| 2 | `cursor-prompt-milestone-3-admin-integration.md` | Users, Meetings list, Calendar, Rooms |
| 3 | `cursor-prompt-milestone-4-admin-integration.md` | Recurrence builder + scope modals |
| 4 | (coming M5) | Notifications bell panel |
| 5 | (coming M6) | Reschedule flow |
| 6 | (coming M8) | Exports & Reports page |

**Do NOT give all files at once** — each milestone file builds on the previous.

---

## Not yet available

| Feature | Milestone |
|---------|-----------|
| Email invite on series create | 5 |
| Reminder per occurrence | 5 |
| `POST /meetings/:id/reschedule` | 6 |
| `GET /meetings/:id/invite.ics` with RRULE | 8 |
| Audit log UI | 6+ |

---

## Quick test

```bash
# Create weekly recurring meeting
curl -X POST http://localhost:5000/api/meetings \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Weekly",
    "start_time": "2026-07-14T09:00:00.000Z",
    "end_time": "2026-07-14T10:00:00.000Z",
    "rrule": "FREQ=WEEKLY;BYDAY=MO;COUNT=4",
    "participants": []
  }'

# List calendar occurrences
curl "http://localhost:5000/api/meetings?view=calendar&from=2026-07-01&to=2026-08-31" \
  -H "Authorization: Bearer TOKEN"

# Cancel single occurrence
curl -X DELETE "http://localhost:5000/api/meetings/3?scope=this" \
  -H "Authorization: Bearer TOKEN"
```
