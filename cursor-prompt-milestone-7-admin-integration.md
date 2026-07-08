# Milestone 7 — Meeting Notes & Action Items (Admin Panel Integration)

Wire **Notes tab** and **Action Items tab** on meeting detail page. Requires Milestones 3–6.

**Base URL:** `http://localhost:5000/api`

---

## What's new in Milestone 7

| Feature | Status |
|---------|--------|
| Meeting notes CRUD | ✅ |
| Note types: MINUTES, DECISION, ACTION_ITEM, PERSONAL | ✅ |
| Action items CRUD | ✅ |
| NOTE_ADDED notifications | ✅ |
| Audit log on official notes | ✅ |
| Rich text editor | Frontend choice (TipTap, Quill, etc.) |
| Exports | ❌ Milestone 8 |

---

## Run migration

```powershell
cd server
npm run db:migrate
npm run dev
```

---

## 1. Meeting Notes API

### GET `/api/meetings/:id/notes`

**Auth:** Required (must have meeting access)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "meeting_id": 1,
      "note_type": "MINUTES",
      "content": "<p>Discussed sprint goals...</p>",
      "is_private": false,
      "version": 1,
      "author": {
        "id": 1,
        "full_name": "Super Admin",
        "email": "superadmin@meetingplanner.local"
      },
      "created_at": "2026-07-07T10:00:00.000Z",
      "updated_at": "2026-07-07T10:00:00.000Z"
    }
  ]
}
```

**Visibility rules:**
- Official notes (MINUTES, DECISION, ACTION_ITEM) — visible to all participants
- PERSONAL + `is_private: true` — only author can see
- USER role can only create PERSONAL notes

### POST `/api/meetings/:id/notes`

**Permissions:**
| note_type | Permission required |
|-----------|-------------------|
| MINUTES, DECISION, ACTION_ITEM | `note.official.edit` (SECRETARY+) |
| PERSONAL | `note.personal.edit` (all roles) |

**Request body:**
```json
{
  "note_type": "MINUTES",
  "content": "<p>Meeting minutes here...</p>",
  "is_private": false
}
```

### PATCH `/api/meetings/:id/notes/:noteId`

**Request body:**
```json
{
  "content": "<p>Updated content...</p>"
}
```

Increments `version` on each edit. Official note edits write audit log.

### DELETE `/api/meetings/:id/notes/:noteId`

Official notes: requires `note.official.edit`  
Personal notes: only author (or ADMIN)

---

## 2. Action Items API

### GET `/api/action-items`

**Query params:**

| Param | Description |
|-------|-------------|
| `meetingId` | Filter by meeting |
| `assigneeId` | Filter by assignee |
| `status` | OPEN, IN_PROGRESS, DONE |
| `page`, `limit` | Pagination |

**Scoping:**
- ADMIN/SECRETARY — see all (with filters)
- USER — only items assigned to them

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "meeting_id": 1,
      "note_id": null,
      "title": "Prepare Q3 report",
      "due_date": "2026-07-20",
      "status": "OPEN",
      "assignee": {
        "id": 2,
        "full_name": "John Doe",
        "email": "john@example.com"
      },
      "meeting": {
        "id": 1,
        "title": "Weekly Planning",
        "start_time": "2026-07-08T10:00:00.000Z"
      },
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
}
```

### POST `/api/action-items`

**Permission:** `note.official.edit` or `meeting.edit` (SECRETARY+)

**Request body:**
```json
{
  "meeting_id": 1,
  "assignee_id": 2,
  "title": "Follow up with client",
  "due_date": "2026-07-15",
  "status": "OPEN",
  "note_id": null
}
```

### PATCH `/api/action-items/:id`

**SECRETARY+** can update all fields.  
**Assignee (USER)** can only update `status`.

```json
{ "status": "IN_PROGRESS" }
```

---

## 3. UI — Meeting detail tabs

Add two new tabs to `/meetings/:id`:

```
[ Overview ] [ Participants ] [ Notes ] [ Action Items ] [ Audit ]
```

### Notes tab

**SECRETARY+** sees:
- "Add Official Note" button → type selector (MINUTES / DECISION)
- Rich text editor for content
- List of all notes with author + timestamp + version

**USER** sees:
- "Add Personal Note" button only
- Own personal notes + official notes (read-only for official)

**Note card layout:**
```
┌─────────────────────────────────────────┐
│  MINUTES                    v2         │
│  by Super Admin · Jul 7, 10:00 AM      │
│  ─────────────────────────────────────  │
│  Discussed sprint goals and blockers... │
│  [Edit] [Delete]          (if allowed)  │
└─────────────────────────────────────────┘
```

**Note type badges:**

| Type | Color |
|------|-------|
| MINUTES | blue |
| DECISION | purple |
| ACTION_ITEM | orange |
| PERSONAL | gray |

### Action Items tab

**List for this meeting:**
```
GET /api/action-items?meetingId=:id
```

**Table columns:** Title | Assignee | Due Date | Status | Actions

**Status badges:**

| Status | Color |
|--------|-------|
| OPEN | yellow |
| IN_PROGRESS | blue |
| DONE | green |

**Add action item form (SECRETARY+):**
- Title
- Assignee (dropdown from GET /api/users)
- Due date
- [Create]

**USER assignee** can mark status: OPEN → IN_PROGRESS → DONE

---

## 4. Dashboard widget (optional)

Show user's open action items on dashboard:

```
GET /api/action-items?assigneeId=ME&status=OPEN&limit=5
```

---

## 5. Notification — NOTE_ADDED

When official note is created, participants get `NOTE_ADDED` notification.

Update notification bell icon for this type: 📝 gray

---

## 6. Axios helpers

```javascript
// client/src/api/notes.js
import api from './axios';

export const getMeetingNotes = (meetingId) =>
  api.get(`/meetings/${meetingId}/notes`);

export const createNote = (meetingId, data) =>
  api.post(`/meetings/${meetingId}/notes`, data);

export const updateNote = (meetingId, noteId, data) =>
  api.patch(`/meetings/${meetingId}/notes/${noteId}`, data);

export const deleteNote = (meetingId, noteId) =>
  api.delete(`/meetings/${meetingId}/notes/${noteId}`);

// client/src/api/actionItems.js
export const getActionItems = (params) =>
  api.get('/action-items', { params });

export const createActionItem = (data) =>
  api.post('/action-items', data);

export const updateActionItem = (id, data) =>
  api.patch(`/action-items/${id}`, data);
```

---

## 7. Permission map

| UI Element | Permission |
|------------|------------|
| Add official note | `note.official.edit` |
| Edit/delete official note | `note.official.edit` |
| Add personal note | `note.personal.edit` |
| Edit own personal note | author or ADMIN |
| Create action item | `note.official.edit` |
| Update action item (full) | `note.official.edit` |
| Update action item status only | assignee |

```javascript
const canOfficialNotes = permissions.includes('note.official.edit');
const canPersonalNotes = permissions.includes('note.personal.edit');
```

---

## 8. Build order

1. `api/notes.js` + `api/actionItems.js` helpers
2. Notes tab on meeting detail (list + create + edit)
3. Rich text editor for note content (store HTML string in `content`)
4. Action Items tab (list + create + status update)
5. Dashboard open action items widget (optional)
6. NOTE_ADDED notification type in bell

---

## Not yet available

| Feature | Milestone |
|---------|-----------|
| ICS download | 8 |
| Exports & Reports page | 8 |
| `GET /api/reports/summary` | 8 |

---

## Quick test

```bash
# Create official note
curl -X POST http://localhost:5000/api/meetings/1/notes \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note_type":"MINUTES","content":"Sprint planning notes..."}'

# Create action item
curl -X POST http://localhost:5000/api/action-items \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"meeting_id":1,"assignee_id":1,"title":"Follow up","due_date":"2026-07-20"}'

# List action items for meeting
curl "http://localhost:5000/api/action-items?meetingId=1" \
  -H "Authorization: Bearer TOKEN"
```

---

## Frontend prompt order

| Done | File |
|------|------|
| ✅ | milestones 3–5 |
| 🔄 | milestone-6.md (in progress) |
| **NEXT (after M6)** | **milestone-7.md (this file)** |
| Last | milestone-8.md (exports + reports) |
