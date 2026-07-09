# Frontend Integration: Meeting Lineage, Follow-up & Notes Distribution

This document describes how the frontend should integrate three related features:

1. **Recurring meeting history** — cumulative notes, minutes, decisions, and action items from previous occurrences
2. **Follow-up meetings** — schedule a follow-up and show only the source meeting's information
3. **Email distribution** — organizer selects official notes and emails them to all participants and guests

**Base API URL:** `http://localhost:5000/api`  
**Auth:** Bearer token on all requests

---

## 1. Meeting context (`lineage`)

Every `GET /api/meetings/:id` response now includes a `lineage` object:

```json
{
  "success": true,
  "data": {
    "id": 15,
    "title": "Weekly Review — 20 Jan",
    "is_recurring": true,
    "recurrence_id": 3,
    "parent_meeting_id": 10,
    "follow_up_source_meeting_id": null,
    "lineage": {
      "type": "RECURRING",
      "current_meeting_id": 15,
      "follow_up_source_meeting_id": null,
      "recurrence_id": 3,
      "source_meetings": [
        { "id": 10, "title": "Weekly Review", "start_time": "2026-01-06T10:00:00.000Z", "occurrence_index": 1 },
        { "id": 12, "title": "Weekly Review", "start_time": "2026-01-13T10:00:00.000Z", "occurrence_index": 2 },
        { "id": 15, "title": "Weekly Review", "start_time": "2026-01-20T10:00:00.000Z", "occurrence_index": 3 }
      ]
    }
  }
}
```

### `lineage.type` values

| Type | Meaning | What to show in Notes / Action Items tabs |
|------|---------|---------------------------------------------|
| `STANDALONE` | Normal one-off meeting | Only this meeting's data |
| `RECURRING` | Part of a recurring series | All occurrences **up to and including** current (`occurrence_index` 1…N) |
| `FOLLOW_UP` | Follow-up meeting linked to a source | **Only** the source meeting's data (not the follow-up's own new entries in lineage view) |

Use `lineage.type` to show a banner, e.g.:

- Recurring: *"Showing records from meetings 1–3 of this series"*
- Follow-up: *"Showing records from source meeting: [title] on [date]"*

---

## 2. Notes with lineage

### `GET /api/meetings/:id/notes?includeLineage=true`

**Default:** `includeLineage=true` (pass `false` to get only the current meeting).

### Response shape

```json
{
  "success": true,
  "data": {
    "lineage": {
      "type": "RECURRING",
      "current_meeting_id": 15,
      "source_meeting_ids": [10, 12, 15],
      "source_meetings": [ /* same as meeting detail */ ]
    },
    "notes": [
      {
        "id": 1,
        "meeting_id": 10,
        "note_type": "MINUTES",
        "content": "Discussed Q4 targets...",
        "is_private": false,
        "version": 1,
        "author": { "id": 2, "full_name": "Ali Khan", "email": "ali@example.com" },
        "created_at": "2026-01-06T11:00:00.000Z",
        "updated_at": "2026-01-06T11:00:00.000Z",
        "source_meeting": {
          "id": 10,
          "title": "Weekly Review",
          "start_time": "2026-01-06T10:00:00.000Z",
          "occurrence_index": 1
        },
        "is_from_previous_meeting": true
      },
      {
        "id": 5,
        "meeting_id": 15,
        "note_type": "DECISION",
        "content": "Approve budget revision.",
        "source_meeting": { "id": 15, "occurrence_index": 3, "...": "..." },
        "is_from_previous_meeting": false
      }
    ]
  }
}
```

### UI recommendations

- Group notes by `source_meeting.occurrence_index` or `source_meeting.start_time`
- Style `is_from_previous_meeting: true` rows differently (e.g. muted background + "Meeting 1" badge)
- **Personal notes** (`PERSONAL`) are always from the **current meeting only** and respect privacy (only author sees private ones)
- Official types in lineage: `MINUTES`, `DECISION`, `ACTION_ITEM` (note type, not the action items table)

### Create note (unchanged)

`POST /api/meetings/:id/notes` — new notes are always saved against the **current** meeting ID.

---

## 3. Action items with lineage

### `GET /api/action-items?meetingId=:id&includeLineage=true`

**Default:** `includeLineage=true` when `meetingId` is provided.

### Response shape (with lineage)

```json
{
  "success": true,
  "data": {
    "lineage": { "type": "RECURRING", "...": "..." },
    "items": [
      {
        "id": 7,
        "meeting_id": 10,
        "title": "Submit report",
        "status": "OPEN",
        "due_date": "2026-01-15",
        "assignee": { "type": "USER", "full_name": "Sara", "email": "sara@example.com", "rsvp_status": "ACCEPTED" },
        "source_meeting": { "id": 10, "occurrence_index": 1, "...": "..." },
        "is_from_previous_meeting": true
      }
    ]
  },
  "meta": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

### UI recommendations

- Same grouping/badge pattern as notes
- New action items: `POST /api/action-items` with `meeting_id` = **current** meeting ID
- Disable editing of items where `is_from_previous_meeting: true` (optional — or allow status updates only)

---

## 4. Follow-up meeting

Organizer schedules a follow-up from an existing meeting. The follow-up is a **new** meeting; notes/action items from the **source** meeting are shown when viewing the follow-up.

### `POST /api/meetings/:id/follow-up`

**Permission:** `meeting.create`  
**Who can call:** Meeting **organizer** or **ADMIN/SUPER_ADMIN**

**Request body:**

```json
{
  "title": "Follow-up: Budget Review",
  "start_time": "2026-01-25T10:00:00.000Z",
  "end_time": "2026-01-25T11:00:00.000Z",
  "room_id": 2,
  "meeting_link": null,
  "description": "Continue discussion from previous meeting",
  "participants": [],
  "guests": []
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `start_time`, `end_time` | Yes | |
| `title` | No | Defaults to `Follow-up: {source title}` |
| `participants`, `guests` | No | Defaults to copying from source meeting |
| `room_id`, `description`, `agenda` | No | Defaults from source if omitted |

**Response:** `201` — full meeting object with `follow_up_source_meeting_id` set and `lineage.type: "FOLLOW_UP"`.

### Frontend flow

1. On meeting detail (organizer only), show **"Schedule Follow-up"** button
2. Open modal with date/time, room, optional title
3. On success, navigate to new meeting detail
4. Notes & Action Items tabs call APIs with `includeLineage=true` — backend returns **only source meeting** data
5. Show banner: *"Displaying information from source meeting: [title]"*

---

## 5. Email notes / minutes / decisions

Organizer selects official notes and sends them to **all participants (users) and guests**.

### `POST /api/meetings/:id/notes/distribute`

**Who can call:** Meeting **organizer** or **ADMIN/SUPER_ADMIN**

**Request body:**

```json
{
  "note_ids": [1, 3, 5],
  "message": "Please review these minutes before our next session."
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `note_ids` | Yes | Array of note IDs (min 1) |
| `message` | No | Optional message shown at top of email |

**Allowed note types:** `MINUTES`, `DECISION`, `ACTION_ITEM` (official note type only)  
**Not allowed:** `PERSONAL` notes

Note IDs must belong to meetings in the current **lineage** (for follow-up, source meeting notes; for recurring, any previous occurrence).

**Response:**

```json
{
  "success": true,
  "data": {
    "distributed_note_ids": [1, 3, 5],
    "recipient_count": 8,
    "results": [
      { "email": "user@example.com", "sent": true },
      { "email": "guest@yopmail.com", "sent": true }
    ]
  }
}
```

### Frontend flow

1. On Notes tab, show checkboxes on official notes (`MINUTES`, `DECISION`, `ACTION_ITEM`)
2. **"Send by Email"** button — organizer only
3. Optional message textarea in confirm modal
4. On submit, call distribute API with selected `note_ids`
5. Show toast: *"Sent to 8 recipients"*

Emails use the same gov-style template (green header, "Meeting Planner System").

---

## 6. Example API calls

```javascript
// Meeting detail (includes lineage)
const meeting = await api.get(`/meetings/${id}`);

// Notes with full recurring history
const { data } = await api.get(`/meetings/${id}/notes`, {
  params: { includeLineage: true },
});
const { lineage, notes } = data;

// Action items with history
const { data: actionData, meta } = await api.get('/action-items', {
  params: { meetingId: id, includeLineage: true },
});

// Schedule follow-up
await api.post(`/meetings/${sourceId}/follow-up`, {
  start_time: '2026-01-25T10:00:00.000Z',
  end_time: '2026-01-25T11:00:00.000Z',
});

// Email selected notes
await api.post(`/meetings/${id}/notes/distribute`, {
  note_ids: selectedIds,
  message: optionalMessage,
});
```

---

## 7. Tab layout suggestion

```
┌─────────────────────────────────────────────────────────────┐
│ [RECURRING] Showing notes from meetings 1–3 of this series  │
├─────────────────────────────────────────────────────────────┤
│ Notes │ Action Items │ Audit │ Overview                     │
├─────────────────────────────────────────────────────────────┤
│ Meeting 1 · 6 Jan 2026                                      │
│ ┌──────── MINUTES ────────────────────────────────────────┐ │
│ │ Discussed Q4 targets...                                │ │
│ └────────────────────────────────────────────────────────┘ │
│ Meeting 2 · 13 Jan 2026                                     │
│ ┌──────── DECISION ───────────────────────────────────────┐ │
│ │ Approve revised timeline.                              │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ [☑] Select notes    [Send by Email]  (organizer only)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Migration required

Run on server deploy:

```bash
npx sequelize-cli db:migrate
```

Migration: `20260112000001-add-follow-up-source-meeting.js`  
Adds `follow_up_source_meeting_id` column to `meetings` table.

---

## 9. Permissions summary

| Action | Who |
|--------|-----|
| View lineage notes/items | Meeting participants, secretary (dept), admin |
| Create follow-up | Organizer + `meeting.create` |
| Distribute notes by email | Organizer or admin |
| Create official notes | Users with `note.official.edit` |

---

## 10. Breaking change note

`GET /api/meetings/:id/notes` response changed from a **flat array** to an object:

```json
{ "lineage": { ... }, "notes": [ ... ] }
```

Update frontend to use `response.data.notes` instead of `response.data` directly.

`GET /api/action-items?meetingId=X` with lineage returns `{ lineage, items }` inside `data` instead of a flat array.
