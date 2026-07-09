# Frontend Integration: Meeting Description, Actions Column & Email

Yeh document un UI fixes ke liye hai jo screenshots mein highlight hue thay:

1. **Title ke neeche `description` show ho** (hardcoded text nahi)
2. **Action Items:** STATUS column sirf badge — status change **ACTIONS** column mein
3. **Notes:** Regular user ko khali ACTIONS column na dikhe
4. **Super Admin / Organizer:** ACTIONS mein **Email** button + recipient dropdown

---

## 1. Meeting header — description

Title ke neeche meeting ki **`description`** field dikhao. API se already aati hai:

```json
GET /api/meetings/:id

{
  "data": {
    "title": "[TEST] Quarterly Review",
    "description": "Test recurring series — open this occurrence to see meetings 1+2+3 data.",
    "start_time": "...",
    "lineage": { ... }
  }
}
```

### UI code (example)

```jsx
<h1>{meeting.title}</h1>
<p className="meeting-description">{meeting.description || ''}</p>
<p className="meeting-datetime">{formatDateTime(meeting.start_time)}</p>
```

**Galat:** Hardcoded string jaise `"Test recurring series..."`  
**Sahi:** `meeting.description` use karo — har meeting ki apni description DB se aayegi

---

## 2. Lineage banner (Notes + Action Items tabs)

`GET /api/meetings/:id` ya notes/action-items response se `lineage` lo:

| `lineage.type` | Banner text |
|----------------|-------------|
| `RECURRING` | `Showing records from meetings 1–{N} of this series` |
| `FOLLOW_UP` | `Showing records from source meeting: {title} ({date})` |
| `STANDALONE` | Banner hide karo |

```jsx
{lineage?.type === 'RECURRING' && lineage.source_meetings?.length > 1 && (
  <div className="lineage-banner">
    RECURRING — Showing records from meetings 1–{lineage.source_meetings.length} of this series
  </div>
)}
```

---

## 3. Action Items table — STATUS vs ACTIONS

### Pehle (galat)
- STATUS column mein dropdown tha
- ACTIONS column khali thi user ke liye

### Ab (sahi)

| Column | Content | Kaun dekhe |
|--------|---------|------------|
| **STATUS** | Sirf read-only badge (`OPEN` / `IN_PROGRESS` / `DONE`) | Sab |
| **REMARKS** | Text (admin edit, user read-only) | Sab |
| **ACTIONS** | Status dropdown + Edit (admin) | Sirf jin ke paas permission ho |

### Kaun status change kar sakta hai?

```javascript
function canUpdateActionItemStatus(item, user, permissions) {
  // Admin / secretary with note.official.edit
  if (permissions.includes('note.official.edit')) return true;
  // Assignee (sirf USER assignee — guest assignee alag flow)
  return item.assignee?.type === 'USER' && item.assignee?.id === user.id;
}
```

### ACTIONS column — sirf tab dikhao jab kuch ho

```javascript
const showActionsColumn = actionItems.some(
  (item) => canUpdateActionItemStatus(item, user, permissions) || canManageOfficialNotes
);

// Table header
{showActionsColumn && <th>ACTIONS</th>}

// Row
{canUpdateActionItemStatus(item, user, permissions) && (
  <td>
    <select
      value={item.status}
      onChange={(e) => updateActionItem(item.id, { status: e.target.value })}
    >
      <option value="OPEN">Open</option>
      <option value="IN_PROGRESS">In Progress</option>
      <option value="DONE">Done</option>
    </select>
  </td>
)}
```

**Note:** Previous meeting ke action items par bhi assignee apna status change kar sakta hai (agar woh assignee hai).

### API

```
PATCH /api/action-items/:id
{ "status": "IN_PROGRESS" }
```

---

## 4. Notes table — ACTIONS column rules

Regular **USER** ko official notes par koi action nahi — is liye unhe **khali ACTIONS column mat dikhao**.

| Role | ACTIONS column mein kya |
|------|------------------------|
| **USER** (participant) | Sirf apni **PERSONAL** notes par Delete |
| **Organizer** | Email + Delete (official notes) |
| **SUPER_ADMIN / ADMIN** | Email + Delete (official notes) |

### ACTIONS column header — conditional

```javascript
const canDistribute = isAdmin || meeting.organizer_id === user.id;
const hasPersonalNoteActions = notes.some(
  (n) => n.note_type === 'PERSONAL' && n.author?.id === user.id
);
const showNotesActionsColumn = canDistribute || hasPersonalNoteActions;
```

Agar `showNotesActionsColumn === false` → **ACTIONS column header hi mat render karo**.

---

## 5. Email — Super Admin / Organizer

### Bulk send (toolbar)
1. Official notes par checkbox (MINUTES, DECISION, ACTION_ITEM note type)
2. Button: **Send by email (N)**
3. Modal: recipient dropdown + optional message

### Per-row send (ACTIONS column)
- **Email** link/button har official note ke saath (organizer/admin only)
- Click → same modal, pre-selected note + recipient dropdown

### Recipient dropdown options

Meeting ke participants + guests se banao:

```javascript
function buildRecipients(meeting) {
  const list = [];
  for (const p of meeting.participants || []) {
    list.push({
      email: p.email || p.user?.email,
      label: `${p.full_name || p.user?.full_name} (Participant)`,
    });
  }
  for (const g of meeting.guests || []) {
    list.push({
      email: g.email,
      label: `${g.name || g.email} (Guest)`,
    });
  }
  return list;
}
```

### API — selective recipient (NEW)

```
POST /api/meetings/:meetingId/notes/distribute
```

**Ek user ko bhejna:**
```json
{
  "note_ids": [12, 15],
  "recipients": [{ "email": "user1@test.com" }],
  "message": "Please review these minutes."
}
```

**Sab ko bhejna** (recipients omit karo):
```json
{
  "note_ids": [12, 15],
  "message": "Please review."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "distributed_note_ids": [12, 15],
    "recipient_count": 1,
    "recipients": [{ "email": "user1@test.com", "type": "USER" }],
    "results": [{ "email": "user1@test.com", "sent": true }]
  }
}
```

**Permission:** Sirf **meeting organizer** ya **ADMIN / SUPER_ADMIN**

**Allowed note types:** `MINUTES`, `DECISION`, `ACTION_ITEM` (not `PERSONAL`)

### Frontend API helper

```javascript
export const distributeNotes = (meetingId, data) =>
  api.post(`/meetings/${meetingId}/notes/distribute`, data);
```

### Email modal flow

```javascript
async function sendNotesEmail(meetingId, noteIds, recipientEmail, message) {
  await distributeNotes(meetingId, {
    note_ids: noteIds,
    recipients: [{ email: recipientEmail }],
    message: message || undefined,
  });
}
```

---

## 6. Table grouping (recurring)

Notes aur Action Items ko `source_meeting` se group karo:

```javascript
// Har note/item par:
note.source_meeting.occurrence_index  // 1, 2, 3
note.source_meeting.start_time
note.is_from_previous_meeting         // true = purani meeting se
```

**Section heading:**
```
Meeting 1 — 16-Jun-2026
Meeting 2 — 23-Jun-2026
```

Previous meeting rows ko halka background + "Previous" badge do.

---

## 7. Role-wise UI summary

### USER (participant, assignee)

| Tab | Dikhe |
|-----|-------|
| Header | title + **description** + date |
| Notes | Read-only official notes, personal notes CRUD |
| Notes ACTIONS | Sirf personal notes Delete — **column tab hi na ho agar koi personal note na ho** |
| Action Items STATUS | Badge only |
| Action Items ACTIONS | Status dropdown **sirf jahan woh assignee ho** |

### SUPER_ADMIN / Organizer

| Tab | Extra |
|-----|-------|
| Notes | Checkbox + Send by email + per-row **Email** in ACTIONS |
| Notes ACTIONS | Email + Delete on official notes |
| Action Items ACTIONS | Edit + Status dropdown (sab items) |

---

## 8. Quick checklist

- [ ] `meeting.description` title ke neeche show ho
- [ ] Lineage banner recurring/follow-up ke liye
- [ ] Action Items: STATUS = badge only
- [ ] Action Items: status dropdown ACTIONS column mein
- [ ] Notes: USER ko khali ACTIONS column na dikhe
- [ ] Organizer/Admin: Email button ACTIONS mein
- [ ] Email modal: recipient dropdown (participants + guests)
- [ ] API: `POST .../notes/distribute` with `recipients: [{ email }]`
- [ ] Notes/Items grouped by `source_meeting.occurrence_index`

---

## 9. Test accounts

| Email | Password | Role |
|-------|----------|------|
| superadmin@meetingplanner.local | SuperAdmin@123 | Super Admin |
| user1@test.com | User@123 | User (assignee) |

Test meeting: `[TEST] Quarterly Review` occurrence 3 — lineage data dikhe ga.

---

## 10. Related docs

- Full lineage/follow-up API: `FRONTEND_LINEAGE_FOLLOWUP_NOTES.md`
