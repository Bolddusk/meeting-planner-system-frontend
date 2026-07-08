# CURSOR PROMPT — Meeting Planner Admin Panel (React Web)

Copy everything below this line into Cursor when building the **admin panel frontend** for the Meeting Planner backend.

---

## ROLE

You are a senior frontend engineer. Build a **desktop-first admin panel** (web browser) for the Meeting Planner System. This is **NOT a mobile app** — do not build mobile-specific APIs, React Native, or native mobile clients. A responsive web layout is fine for tablet/desktop browsers only.

Wire every screen to the existing Node.js REST API at `http://localhost:5000`. Match the backend contract exactly.

## BACKEND STATUS (already built / in progress)

### ✅ Milestone 1 — Done
- Express server on port `5000`
- MySQL database: `meeting_planner`
- Tables: `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `departments`
- Seed data: 4 roles, 19 permissions, 4 departments, super admin user
- Health check: `GET /api/health`

**Super admin seed credentials:**
- Email: `superadmin@meetingplanner.local`
- Password: `SuperAdmin@123`

### 🔜 Milestone 2 — Auth + RBAC + User APIs (build frontend after this is ready)
- `POST /api/auth/register`, `/login`, `/refresh`, `/logout`
- `GET /api/users/me`, `PATCH /api/users/me/reminder-preferences`
- `GET /api/users`, `PATCH /api/users/:id/role`

### 🔜 Milestones 3–8 — Meetings, notifications, exports, etc.
Frontend should be built incrementally; stub/mock only when an endpoint is not yet available, then replace with real API calls.

---

## TECH STACK (fixed)

- **Framework:** React 18 + Vite
- **Routing:** React Router v6
- **HTTP:** Axios (with interceptors for JWT refresh)
- **Styling:** TailwindCSS
- **Forms:** React Hook Form + Zod (or Joi-compatible validation)
- **Tables:** TanStack Table (or similar) for user/meeting lists
- **Calendar:** FullCalendar (when meetings API is ready)
- **Icons:** Lucide React or Heroicons
- **State:** React Context or Zustand for auth/user session
- **Project folder:** `/client` in monorepo root (`meeting-planner-system/client`)

**Do NOT use:** React Native, Expo, Flutter, or any mobile framework.

---

## API CONTRACT

### Base URL
```
http://localhost:5000/api
```

### Response envelope (all endpoints)
```json
{
  "success": true,
  "data": { },
  "meta": { "page": 1, "limit": 20, "total": 100 },
  "error": null
}
```

Error response:
```json
{
  "success": false,
  "data": null,
  "meta": null,
  "error": { "message": "...", "details": null }
}
```

### Auth headers
```
Authorization: Bearer <access_token>
```

On `401`, call `POST /api/auth/refresh` with refresh token, retry request, or redirect to login.

### List query params (all list endpoints)
`page`, `limit`, `sort`, `order` (asc|desc)

---

## ROLES (admin panel access)

| Role | Admin panel access |
|------|-------------------|
| **SUPER_ADMIN** | Full access — org settings, all users, all meetings, audit, reports |
| **ADMIN** | User management, meetings, rooms, exports, reports, audit (no org settings) |
| **SECRETARY** | Limited admin — own department meetings, notes, no user management |
| **USER** | **No admin panel** — redirect to a separate user portal (out of scope for now) |

Admin panel is for **SUPER_ADMIN, ADMIN, and SECRETARY** only. Block USER role at login with a clear message.

---

## PERMISSIONS (hide/disable UI by permission code)

Backend enforces these server-side; frontend must mirror them:

| Permission code | Admin UI |
|-----------------|----------|
| `org.settings.manage` | Org settings page (SUPER_ADMIN only) |
| `user.manage` | User list, create, edit, deactivate |
| `user.role.assign` | Role assignment dropdown |
| `meeting.create` | Create meeting button |
| `meeting.edit` | Edit meeting |
| `meeting.cancel` | Cancel meeting |
| `meeting.reschedule` | Reschedule action |
| `meeting.recurrence.configure` | Recurrence builder in meeting form |
| `meeting.view.scoped` | Filter meetings by department (SECRETARY) |
| `note.official.edit` | Official minutes tab on meeting detail |
| `export.ics` | Download ICS button |
| `export.meeting_log` | Export meeting log |
| `export.report` | Reports page |
| `audit.view` | Audit log tab/page |
| `room.manage` | Rooms CRUD page |
| `reminder.preferences.manage` | Settings → reminder prefs |

Store permissions from `GET /api/users/me` response and use a `can('permission.code')` helper.

---

## ADMIN PANEL PAGES

Build in this order:

### 1. Auth — Login
- Route: `/login`
- Form: email + password
- Call `POST /api/auth/login`
- Store access + refresh tokens (httpOnly cookie preferred; if localStorage, document the risk)
- Redirect to `/dashboard` on success
- Show clear error on invalid credentials
- **No register page in admin panel** (admins are created by SUPER_ADMIN/ADMIN)
- **No forgot password** in v1 unless backend adds it

### 2. Layout shell
- Sidebar navigation (collapsible on smaller desktop widths)
- Top bar: page title, notification bell (when API ready), user menu (profile, logout)
- Logout → `POST /api/auth/logout` + clear tokens
- Protected routes — redirect unauthenticated users to `/login`

**Sidebar items (role-gated):**
```
Dashboard
Meetings          → /meetings
Calendar          → /calendar
Users             → /users          (ADMIN+)
Rooms             → /rooms          (ADMIN+)
Exports & Reports → /exports      (ADMIN+, limited SECRETARY)
Audit Log         → /audit          (ADMIN+)
Settings          → /settings
```

### 3. Dashboard — `/dashboard`
- **All roles:** upcoming meetings (next 7 days), pending RSVPs, unread notifications count
- **ADMIN+:** stats cards from `GET /api/reports/summary?from=&to=`
  - Total meetings this month
  - Attendance rate
  - Room utilization %
  - Open action items
- Quick actions: "New Meeting", "Manage Users" (if permitted)

### 4. Meetings list — `/meetings`
- Table view with filters: date range, status, department, organizer
- API: `GET /api/meetings?from=&to=&status=&deptId=&view=list`
- Columns: title, date/time (show in user's timezone), organizer, room, status, participants count
- Actions: view, edit, cancel (permission-gated)
- Pagination via `meta`

### 5. Calendar view — `/calendar`
- FullCalendar: month / week / day views
- API: `GET /api/meetings?from=&to=&view=calendar`
- Click event → meeting detail drawer or `/meetings/:id`
- Color-code by status: SCHEDULED, RESCHEDULED, CANCELLED, COMPLETED, IN_PROGRESS

### 6. Meeting create/edit modal
- Fields: title, description, participants (multi-select from users), room, start/end datetime, virtual link, department, agenda (JSON/list)
- **Recurrence builder** (when API ready): daily / weekly / monthly, interval, end condition → generates RRULE string sent in POST body
- On save: `POST /api/meetings` or `PATCH /api/meetings/:id?scope=this|following|series`
- Show conflict warning if API returns overlap error

### 7. Meeting detail — `/meetings/:id`
- Tabs: Overview | Participants & RSVP | Notes | Action Items | Audit (ADMIN+)
- Overview: title, time, room, link, agenda, status badge
- Participants: list with RSVP status (PENDING/ACCEPTED/DECLINED/TENTATIVE), check-in status
- Notes: rich text editor for official minutes (SECRETARY+); read-only for others
- Action items: list with assignee, due date, status
- Actions (role-gated): Reschedule, Cancel, Download ICS (`GET /api/meetings/:id/invite.ics`)

### 8. User management — `/users` (ADMIN+)
- API: `GET /api/users` (SECRETARY sees own dept only)
- Table: name, email, role, department, active status, created date
- Create user modal: full_name, email, phone, password, role, department
- Edit: deactivate, change role via `PATCH /api/users/:id/role`
  - SUPER_ADMIN can assign ADMIN role
  - ADMIN can assign SECRETARY and USER only
- Pagination + search by name/email

### 9. Rooms — `/rooms` (ADMIN+)
- API: `GET /api/rooms`, `POST /api/rooms`
- Table: name, capacity, location, virtual (yes/no)
- Create/edit modal

### 10. Exports & Reports — `/exports`
- Form: export type (MEETING_LOG | REPORT | ICS_INVITE), format (PDF | CSV | XLSX | ICS), date range, department filter
- Submit: `POST /api/exports`
- Job list: poll `GET /api/exports/:id` until status = READY
- Download: `GET /api/exports/:id/download?token=`
- Show job status badges: QUEUED, PROCESSING, READY, FAILED

### 11. Audit log — `/audit` (ADMIN+)
- API: `GET /api/audit-log?meetingId=&from=&to=`
- Table: timestamp, actor, action, meeting, old/new values (JSON diff view)
- Filters: date range, meeting ID

### 12. Settings — `/settings`
- Profile: full_name, phone, timezone, avatar (PATCH via users/me when available)
- Reminder preferences: channels (EMAIL, IN_APP), lead times in minutes (1440, 60, 15)
- API: `PATCH /api/users/me/reminder-preferences`

### 13. Notifications panel (top bar)
- Bell icon with unread count
- API: `GET /api/notifications`, `PATCH /api/notifications/:id/read`
- Dropdown list: INVITE, REMINDER, RESCHEDULE, CANCELLATION, etc.

---

## AUTH FLOW (Axios setup)

```javascript
// Request interceptor — attach access token
axios.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — refresh on 401
axios.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return axios(error.config);
      }
      redirectToLogin();
    }
    return Promise.reject(error);
  }
);
```

---

## UI / UX GUIDELINES

- **Desktop-first:** min width 1024px optimized; sidebar layout, data tables, modals
- **Professional admin look:** clean whites/grays, primary accent color (blue or indigo), clear typography
- **Timezone:** display all meeting times in logged-in user's timezone (from `users/me`); send UTC to API
- **Loading states:** skeleton loaders on tables and dashboard cards
- **Error states:** toast notifications for API errors using `error.message` from envelope
- **Empty states:** friendly message + CTA when no meetings/users exist
- **Role-aware:** hide nav items and buttons user cannot use; show tooltip "Insufficient permission" if needed
- **No mobile bottom nav, no swipe gestures, no PWA install prompt**

---

## FOLDER STRUCTURE

```
client/
├── public/
├── src/
│   ├── api/              # Axios instance + per-resource API functions
│   │   ├── axios.js
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── meetings.js
│   │   └── ...
│   ├── components/
│   │   ├── layout/       # Sidebar, Topbar, ProtectedRoute
│   │   ├── ui/           # Button, Modal, Table, Badge, Toast
│   │   └── meetings/     # MeetingForm, MeetingCard, RecurrenceBuilder
│   ├── context/          # AuthContext
│   ├── hooks/            # useAuth, usePermission
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Meetings.jsx
│   │   ├── Calendar.jsx
│   │   ├── MeetingDetail.jsx
│   │   ├── Users.jsx
│   │   ├── Rooms.jsx
│   │   ├── Exports.jsx
│   │   ├── AuditLog.jsx
│   │   └── Settings.jsx
│   ├── utils/            # formatDate, can(), token helpers
│   ├── App.jsx
│   └── main.jsx
├── .env.example          # VITE_API_URL=http://localhost:5000/api
├── tailwind.config.js
├── vite.config.js
└── package.json
```

---

## ENV (client)

```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=Meeting Planner Admin
```

---

## BUILD ORDER (frontend milestones)

1. **Scaffold** — Vite + React + Tailwind + Router + Axios; folder structure
2. **Auth** — Login page, AuthContext, protected routes, token refresh (wire when Milestone 2 backend is ready)
3. **Layout** — Sidebar, topbar, role-gated navigation
4. **Dashboard** — stats cards + upcoming meetings (mock until APIs ready)
5. **User management** — table + create/edit (after Milestone 2)
6. **Meetings** — list + create/edit modal (after Milestone 3)
7. **Calendar** — FullCalendar integration (after Milestone 3)
8. **Meeting detail** — tabs for notes, action items, audit (after Milestones 6–7)
9. **Rooms, Exports, Audit, Settings** — as backend endpoints become available
10. **Polish** — loading/error states, timezone display, permission checks

---

## WHAT NOT TO BUILD (out of scope)

- ❌ Mobile app (React Native / Expo / Flutter)
- ❌ Mobile-specific API endpoints or `/api/mobile/*` routes
- ❌ User self-service portal for USER role (separate project)
- ❌ Public registration page in admin panel
- ❌ Offline mode / service workers
- ❌ Real-time WebSocket (use polling for export job status)

---

## BACKEND API REFERENCE (full list — implement UI as each becomes available)

```
POST   /api/auth/login  /api/auth/refresh  /api/auth/logout
GET    /api/users/me                     PATCH /api/users/me/reminder-preferences
GET    /api/users                        PATCH /api/users/:id/role

GET    /api/meetings?from=&to=&status=&deptId=&view=calendar|list
POST   /api/meetings
GET    /api/meetings/:id
PATCH  /api/meetings/:id?scope=this|following|series
POST   /api/meetings/:id/reschedule
DELETE /api/meetings/:id
POST   /api/meetings/:id/rsvp
GET    /api/meetings/:id/invite.ics

GET|POST|PATCH|DELETE  /api/meetings/:id/notes
GET|POST|PATCH         /api/action-items

GET    /api/notifications                PATCH /api/notifications/:id/read
GET    /api/rooms  POST /api/rooms

POST   /api/exports
GET    /api/exports/:id
GET    /api/exports/:id/download?token=

GET    /api/audit-log?meetingId=&from=&to=
GET    /api/reports/summary?from=&to=
GET    /api/health
```

---

## START INSTRUCTION

Begin with **Frontend Milestone 1**: scaffold `/client` with Vite + React + Tailwind + Router. Create Login page and layout shell. Use mock auth until backend Milestone 2 is deployed, then wire real `POST /api/auth/login`.

Do not build mobile. Desktop admin panel only.
