# Attendance System — Full Documentation

A full-stack employee attendance management system. Employees clock in and out through a public self-service kiosk. Admins manage everything — companies, departments, employees, reports, and analytics — through a protected admin panel.

---

## Table of Contents

1. [Adding a New Admin](#1-adding-a-new-admin)
2. [How Login Works](#2-how-login-works)
3. [Employee Kiosk](#3-employee-kiosk)
4. [Admin Panel Pages](#4-admin-panel-pages)
5. [How the Backend Works](#5-how-the-backend-works)
6. [Database Schema](#6-database-schema)
7. [Tech Stack](#7-tech-stack)
8. [Project Structure](#8-project-structure)
9. [Local Setup](#9-local-setup)
10. [Deployment on Render](#10-deployment-on-render)

---

## 1. Adding a New Admin

This is the most important first step after deploying.

### The primary admin account

The first admin account is **not stored in the database**. It is configured entirely through environment variables:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=yourpassword
```

These are set in your Render backend service's environment settings (or in `backend/.env` for local development). When someone logs in with these credentials, the backend skips the database and signs a JWT directly from those env values. **Change these from the defaults before going live.**

### Adding additional admin accounts

Once logged in as the primary admin:

1. Go to **Settings** in the left sidebar.
2. Scroll down to the **Admin Accounts** section.
3. Click **+ Add Admin**.
4. Enter a username and a password (minimum 6 characters).
5. Confirm the password and click **Create Account**.

The new account is stored in the `admins` database table with a securely hashed password (using Node's `crypto.scrypt`). The new admin can immediately log in at the `/login` page with the same full access as the primary admin.

### Deleting an admin account

In the same Admin Accounts section, each account has a **Delete** button. You cannot delete the account you are currently logged in with. The primary admin account (set via env vars) does not appear in this list and cannot be deleted from the panel — only by changing the environment variables.

> **Important:** The primary admin username is reserved. You cannot create a database account with the same username as `ADMIN_USERNAME`.

---

## 2. How Login Works

**File:** `backend/src/modules/auth/auth.service.js`

The login endpoint (`POST /api/auth/login`) checks credentials in this order:

1. **Primary admin check** — If the username and password match `ADMIN_USERNAME` / `ADMIN_PASSWORD` from env vars, a JWT is signed immediately without touching the database.
2. **Database admin check** — If the primary check fails, the system looks up the username in the `admins` table and verifies the password using `scrypt`.
3. If neither matches, a 401 error is returned.

On success, the server returns a signed JWT token. The frontend stores this token in `localStorage` under the key `admin_token` and sends it as a `Bearer` token in the `Authorization` header on every subsequent request.

**Token expiry:** 8 hours. After expiry, any protected API request returns 401, which automatically redirects the user to the login page.

**Auth middleware:** `backend/src/middleware/auth.js` — runs before every admin route. It reads the `Authorization` header, verifies the JWT using `JWT_SECRET`, and attaches the decoded user to `req.user`. If the token is missing or invalid, it returns 401 immediately.

---

## 3. Employee Kiosk

**URL:** `/kiosk` (public, no login required)  
**File:** `frontend/src/pages/Kiosk.jsx`  
**Backend:** `backend/src/modules/kiosk/kiosk.service.js`

The kiosk is the page employees use to clock in and out. It is entirely public — no login needed.

### Flow

1. Employee selects their **Company** from a dropdown.
2. They optionally filter by **Department**.
3. They select their **Name** from the employee list.
4. The system fetches their status and shows whether their next action is **Clock In** or **Clock Out**.
5. They tap the button. The browser requests their GPS location.
6. The location is sent to the backend with the employee ID.
7. The backend checks if the employee is within the allowed radius of the company's GPS location. If not, access is denied with a distance message.
8. The backend records the clock-in or clock-out and returns the result.
9. A confirmation screen shows the employee's name, the time, and whether they were marked **Late** or **Left Early**.
10. The screen auto-resets after 4 seconds.

### Once-per-day rule

An employee can only clock in **once per day**. After completing a full clock-in → clock-out cycle, the button is disabled and shows "Attendance complete for today". This is enforced on both the frontend (button disabled, status banner shown) and the backend (returns 409 if the employee tries to scan again after already clocking out).

### Late and early detection

**File:** `backend/src/shared/utils/attendance.js`

- **Late:** The employee's clock-in time is compared to their personal `shift_start` time. If they clock in more than `late_threshold_minutes` (configured in Settings) after their shift start, they are marked as late (`is_late = 1`).
- **Early departure:** The clock-out time is compared to `shift_end`. If they leave before their shift ends, they are marked as early (`is_early = 1`).

Both checks use the configured **timezone** (default: `Africa/Lagos`) so times are always evaluated in local time, not UTC.

### GPS geofencing

Each company can have a GPS coordinate and a radius (in metres) set. If a company has coordinates set, all employees at that company must be within the radius to clock in. If the company has no coordinates, geofencing is skipped.

---

## 4. Admin Panel Pages

All pages below require a valid login token.

### Dashboard

**File:** `frontend/src/pages/Dashboard.jsx`  
**API:** `GET /api/dashboard/stats`, `GET /api/dashboard/live`, `GET /api/dashboard/notifications`

The dashboard is the home screen after login. It shows:

- **Summary stats:** Total active employees, clocked in today, currently inside, late today, on leave, absent.
- **Live feed:** A real-time table of employees currently clocked in, with their name, department, and clock-in time.
- **Weekly bar chart:** Clock-ins vs late arrivals for the last 7 days.
- **Notification bell:** Alerts for late arrivals, overdue employees (still inside after shift end), and recent activity. Refreshes every 60 seconds.

### Attendance Logs

**File:** `frontend/src/pages/Attendance.jsx`  
**API:** `GET /api/attendance`, `POST /api/attendance/manual`, `DELETE /api/attendance/:id`

Shows all clock-in and clock-out records. Filterable by date, employee, department, and type (clock-in/out). Admins can:

- **Add a manual entry** — useful for correcting missed clock-ins or adding records for employees who forgot to use the kiosk.
- **Delete a record** — with a confirmation dialog. Deleted records are gone permanently.

### Employees

**File:** `frontend/src/pages/Employees.jsx`  
**API:** `GET /api/employees`, `POST /api/employees`, `PUT /api/employees/:id`, `DELETE /api/employees/:id`

Full CRUD management for employees. Each employee record contains:

| Field | Description |
|---|---|
| Employee ID | Auto-generated unique ID (e.g. `EMP001`) |
| Name | Full name |
| Email / Phone | Contact info (optional) |
| Company | Which company they belong to |
| Department | Which department |
| Shift Start / End | Their working hours (e.g. `09:00` – `17:00`) |
| Status | `active` or `inactive` |

Inactive employees are hidden from the kiosk dropdown and excluded from attendance stats.

### Companies

**File:** `frontend/src/pages/Companies.jsx`  
**API:** `GET /api/companies`, `POST /api/companies`, `PUT /api/companies/:id`, `PATCH /api/companies/:id/location`, `DELETE /api/companies/:id`

Manage company records. Each company can have:
- A name and address.
- A GPS location (latitude, longitude) and allowed clock-in radius in metres.
- A list of departments (managed from within the company card).

Setting a GPS location enables geofencing for all employees under that company.

### Departments

**File:** `frontend/src/pages/Companies.jsx` (managed inline per company)  
**API:** `GET /api/companies/:id/departments`, `POST /api/companies/:id/departments`, `DELETE /api/companies/:companyId/departments/:deptId`

Departments belong to a company. They are added and removed from the Companies page — click the **Departments** button on any company card. Employees are assigned to a department when they are created or edited.

### Reports

**File:** `frontend/src/pages/Reports.jsx`  
**API:** `GET /api/reports/summary`, `GET /api/reports/daily`, `GET /api/reports/export`, `GET /api/reports/audit`

Four report views:

- **Summary** — Attendance summary per employee over a date range (today / last 7 days / this month / custom). Shows days present, total clock-ins, late count, first clock-in, last clock-out.
- **Daily Log** — Every clock-in/out record for a single date, across all employees.
- **Export** — Downloads a CSV file of all attendance records for the selected period. The CSV includes employee ID, name, department, type, timestamp, late flag, source (kiosk or manual), and notes.
- **Audit Log** — A log of admin actions taken in the system (last 200 entries).

### Analytics

**File:** `frontend/src/pages/Analytics.jsx`  
**API:** `GET /api/analytics`

Four charts built with Recharts:

- **7-Day Attendance Trend** — Bar chart showing on-time vs late attendance for the past week.
- **Today's Breakdown** — Pie chart of on-time / late / absent for today.
- **Department Attendance** — Horizontal bar chart showing attendance rate per department today.
- **Clock-In Hours** — Distribution of what time employees clock in (6am to 8pm).

### Settings

**File:** `frontend/src/pages/Settings.jsx`  
**API:** `GET /api/settings`, `PUT /api/settings`

Two sections:

**General Settings:**
- System name
- Timezone (used for all late/early calculations)
- Default work start and end times (applied when creating new employees)
- Late threshold in minutes (how many minutes past shift start before an employee is considered late)

**Admin Accounts:**
- View all database-stored admin accounts
- Create new admin accounts
- Delete admin accounts (cannot delete your own account)

---

## 5. How the Backend Works

**Entry point:** `backend/src/app.js`

The backend is a standard Express API server. On startup it:
1. Connects to PostgreSQL.
2. Runs `initializeDatabase()` which creates all tables if they don't exist and seeds default settings.
3. Starts listening on the configured `PORT`.

### Architecture

The backend follows a **Controller → Service → Route** pattern with feature-based modules.

Every module has 3 files with one job each:

| File | Responsibility |
|---|---|
| `routes.js` | Defines URL endpoints only and maps them to controller functions |
| `controller.js` | Handles HTTP — validates input, calls the service, sends the response |
| `service.js` | Does the actual work — database queries and business logic. No HTTP here. |

### Route protection

Public routes (no token needed):
- `POST /api/auth/login`
- All `/api/kiosk/*` routes

All other routes pass through `authMiddleware` before the route handler runs. Any request without a valid JWT is rejected with 401.

---

### Shared Layer

#### `shared/database.js`

**Creates all database tables on startup** via `initializeDatabase()` and **exports 4 query helper functions** used by every service:

| Function | Returns |
|---|---|
| `query(sql, params)` | All matching rows as an array |
| `queryOne(sql, params)` | First row only, or `null` |
| `execute(sql, params)` | First row of result (useful for `RETURNING id` on inserts) |
| `transaction(fn)` | Wraps multiple queries in BEGIN/COMMIT; rolls back on error |

#### `shared/middleware/auth.js`

Reads the `Authorization: Bearer <token>` header, verifies the JWT, and attaches the decoded payload to `req.user`. Returns `401` immediately if the token is missing or invalid.

#### `shared/utils/attendance.js`

Shared logic used by both the kiosk and attendance modules:

| Function | Purpose |
|---|---|
| `logAttendance()` | Core function — inserts a clock in/out record, calculates late/early flags, fires confirmation email |
| `getNextLogType()` | Returns what an employee should do next: `clock_in`, `clock_out`, or `done` |
| `isLate()` | Compares clock-in time against shift start + the late threshold from settings |
| `haversine()` | Calculates straight-line distance in metres between two GPS coordinates |
| `getSetting()` | Fetches a single value from the settings table by key |

#### `shared/utils/email.js`

Nodemailer email sender. If `SMTP_USER` is blank in `.env`, all sending is silently skipped.

| Function | Sends |
|---|---|
| `sendWelcomeEmail()` | HTML email when an employee account is created — shows Employee ID, company, department, shift hours |
| `sendClockEmail()` | HTML email on every clock in/out — shows the time and On Time / Late / Early Departure badge |

---

### Module Breakdown

#### Auth Module — `/api/auth`

| Method | Path | Description |
|---|---|---|
| POST | `/login` | Admin login — returns a JWT valid for 8 hours |

`service.js` checks credentials in two ways: first the hardcoded `ADMIN_USERNAME`/`ADMIN_PASSWORD` from `.env` (the super admin), then falls back to the `admins` database table using `crypto.scrypt` password verification.

---

#### Kiosk Module — `/api/kiosk` (Public)

| Method | Path | Description |
|---|---|---|
| GET | `/companies` | List of companies for the dropdown |
| GET | `/departments?company_id=` | Departments filtered by company |
| GET | `/employees?company_id=&department_id=` | Active employees for selection |
| GET | `/status/:employeeId` | What the employee should do next (clock in / clock out / done) |
| POST | `/scan` | Submit a clock in or clock out |

The `scan` function in `service.js`:
1. Fetches the employee and their company's GPS coordinates
2. Determines the next action: clock in, clock out, or already done
3. If the company has GPS set, checks the submitted location is within `radius_meters` — applies to **both** clock in and clock out
4. Calls `logAttendance()` to write the record and send the confirmation email

---

#### Employees Module — `/api/employees`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List all employees (filterable by company, department, status, search) |
| GET | `/next-id?company_id=` | Generate the next employee ID (e.g. `ACM001`) |
| GET | `/:id` | Get one employee |
| POST | `/` | Create an employee — fires a welcome email |
| PUT | `/:id` | Update an employee |
| DELETE | `/:id` | Deactivate (soft delete) |
| DELETE | `/:id/permanent` | Permanently delete the employee and all their attendance logs |

---

#### Companies Module — `/api/companies` and `/api/departments`

This module contains 6 files — departments are co-located here because they are tightly coupled to companies.

**Company endpoints:**

| Method | Path | Description |
|---|---|---|
| GET | `/` | List all companies with live employee and department counts |
| GET | `/:id` | Get one company |
| POST | `/` | Create a company |
| PUT | `/:id` | Update name and address |
| PATCH | `/:id/location` | Update GPS coordinates and geofence radius |
| DELETE | `/:id` | Delete (nullifies linked employees and departments first) |
| GET | `/:id/departments` | Departments under a specific company |
| POST | `/:id/departments` | Create a department under a company |
| DELETE | `/:companyId/departments/:deptId` | Delete a department under a company |

**Standalone department endpoints:**

| Method | Path | Description |
|---|---|---|
| GET | `/api/departments` | All departments (optional `?company_id=` filter) |
| POST | `/api/departments` | Create a department |
| PUT | `/api/departments/:id` | Update a department |
| DELETE | `/api/departments/:id` | Delete a department (nullifies employee links first) |

---

#### Attendance Module — `/api/attendance`

| Method | Path | Description |
|---|---|---|
| GET | `/` | All logs with filters (employee, date range, department, type) |
| GET | `/today` | Today's logs only |
| GET | `/employee/:id` | Logs for one specific employee |
| POST | `/manual` | Create a manual log — goes through the same late-check and email logic as a kiosk scan |
| DELETE | `/:id` | Delete a specific log |

---

#### Dashboard Module — `/api/dashboard`

| Method | Path | Description |
|---|---|---|
| GET | `/stats` | Total active, clocked in today, currently inside, late today, absent, on leave, 7-day chart |
| GET | `/notifications` | Late arrivals, overdue employees, recent activity — combined into one notification list |
| GET | `/live` | Employees currently inside (last log today was a clock in) |

---

#### Reports Module — `/api/reports`

| Method | Path | Description |
|---|---|---|
| GET | `/summary` | Per-employee totals over a date range (days present, clock-ins, late count) |
| GET | `/daily` | All logs for a specific date |
| GET | `/export` | Download as a CSV file — streams directly, no temp file |
| GET | `/audit` | Last 200 audit log entries |

The `period` query param accepts `week`, `month`, or `day`. Explicit `from`/`to` dates override it.

---

#### Analytics Module — `/api/analytics`

| Method | Path | Description |
|---|---|---|
| GET | `/` | Full analytics dataset for charts |

Returns 4 datasets in one response:

| Dataset | Contents |
|---|---|
| `weekly` | Last 7 days — present / late / on-time / absent per day (uses `generate_series` so empty days still appear) |
| `today` | On-time, late, absent, total, attendance rate % |
| `by_department` | Today's attendance per department with rate % |
| `hourly` | Clock-in count by hour (6am–8pm) for today |

---

#### Settings Module — `/api/settings`

| Method | Path | Description |
|---|---|---|
| GET | `/` | All settings as a key-value object |
| PUT | `/` | Update any number of settings at once |

Default settings inserted on first startup: `late_threshold_minutes`, `work_start_time`, `work_end_time`, `company_name`, `timezone`.

---

#### Admin Accounts Module — `/api/admin-accounts`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List all admin accounts |
| POST | `/` | Create a new admin (password hashed with `crypto.scrypt`) |
| DELETE | `/:username` | Delete an admin (super admin is protected) |

The super admin (`ADMIN_USERNAME` from `.env`) cannot be registered as a username or deleted via this endpoint.

---

## 6. Database Schema

All tables are created automatically on first server start.

| Table | Description |
|---|---|
| `companies` | Company name, address, GPS coordinates, and clock-in radius |
| `departments` | Department names, linked to a company |
| `employees` | Employee profiles: name, ID, company, department, shift times, status |
| `attendance_logs` | Every clock-in/out: employee, type, timestamp, late flag, early flag, manual flag, notes |
| `settings` | Key-value pairs for system configuration |
| `leaves` | Leave records with status (approved/pending/rejected) |
| `audit_logs` | Admin action history |
| `admins` | Additional admin accounts with hashed passwords |

### Important columns in `attendance_logs`

| Column | Type | Notes |
|---|---|---|
| `type` | VARCHAR | Either `'clock_in'` or `'clock_out'` |
| `is_late` | SMALLINT | `1` if the employee clocked in late, `0` otherwise |
| `is_early` | SMALLINT | `1` if the employee clocked out early, `0` otherwise |
| `is_manual` | SMALLINT | `1` if the record was added by an admin, `0` if from the kiosk |

---

## 7. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS v4, shadcn/ui, Recharts, React Router DOM |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Authentication | JWT (Bearer token, 8-hour expiry) |
| Password hashing | Node.js `crypto.scrypt` |
| Charts | Recharts |
| Hosting | Render (backend web service + frontend static site) |

---

## 8. Project Structure

```
/
├── backend/
│   └── src/
│       ├── app.js                          # Express server entry point
│       ├── shared/
│       │   ├── database.js                 # PostgreSQL connection, schema init, query helpers
│       │   ├── middleware/
│       │   │   └── auth.js                 # JWT verification middleware
│       │   └── utils/
│       │       ├── attendance.js           # Core clock-in/out logic and GPS helpers
│       │       └── email.js                # Nodemailer email sender
│       └── modules/
│           ├── auth/
│           │   ├── auth.routes.js
│           │   ├── auth.controller.js
│           │   └── auth.service.js
│           ├── kiosk/
│           │   ├── kiosk.routes.js
│           │   ├── kiosk.controller.js
│           │   └── kiosk.service.js
│           ├── employees/
│           │   ├── employee.routes.js
│           │   ├── employee.controller.js
│           │   └── employee.service.js
│           ├── companies/                  # Also contains department files
│           │   ├── company.routes.js
│           │   ├── company.controller.js
│           │   ├── company.service.js
│           │   ├── department.routes.js
│           │   ├── department.controller.js
│           │   └── department.service.js
│           ├── attendance/
│           │   ├── attendance.routes.js
│           │   ├── attendance.controller.js
│           │   └── attendance.service.js
│           ├── dashboard/
│           │   ├── dashboard.routes.js
│           │   ├── dashboard.controller.js
│           │   └── dashboard.service.js
│           ├── reports/
│           │   ├── report.routes.js
│           │   ├── report.controller.js
│           │   └── report.service.js
│           ├── analytics/
│           │   ├── analytics.routes.js
│           │   ├── analytics.controller.js
│           │   └── analytics.service.js
│           ├── settings/
│           │   ├── settings.routes.js
│           │   ├── settings.controller.js
│           │   └── settings.service.js
│           └── adminAccounts/
│               ├── adminAccounts.routes.js
│               ├── adminAccounts.controller.js
│               └── adminAccounts.service.js
└── frontend/
    └── src/
        ├── api/
        │   └── index.js                    # Axios client with auth interceptor
        ├── context/
        │   └── AuthContext.jsx             # Login state and token management
        ├── pages/
        │   ├── Login.jsx
        │   ├── Kiosk.jsx
        │   ├── Dashboard.jsx
        │   ├── Attendance.jsx
        │   ├── Employees.jsx
        │   ├── Companies.jsx
        │   ├── Reports.jsx
        │   ├── Analytics.jsx
        │   └── Settings.jsx
        └── components/                     # Shared UI components (shadcn/ui based)
```

---

## 9. Local Setup

### Prerequisites

- Node.js 18+
- PostgreSQL running locally

### Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=5000
NODE_ENV=development

# Use one of the two options below:

# Option A — connection string
DATABASE_URL=postgresql://user:password@localhost:5432/attendance_db

# Option B — individual fields
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=attendance_db

# Auth
JWT_SECRET=any_random_string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=yourpassword
```

```bash
npm run dev    # starts with nodemon (auto-restart on changes)
npm start      # production start
```

The database tables are created automatically on first start. You do not need to run any migrations.

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000
```

> This must be the backend origin only — do **not** include `/api` at the end. The code appends `/api` automatically.

```bash
npm run dev    # starts Vite dev server on port 3000
npm run build  # builds to frontend/dist
```

---

## 10. Deployment on Render

### Backend — Web Service

| Setting | Value |
|---|---|
| Environment | Node |
| Build Command | `cd backend && npm install` |
| Start Command | `cd backend && npm start` |

**Environment variables to set:**

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Render PostgreSQL connection string |
| `JWT_SECRET` | A long random string |
| `ADMIN_USERNAME` | Your admin username |
| `ADMIN_PASSWORD` | A strong password |
| `NODE_ENV` | `production` |

### Frontend — Static Site

| Setting | Value |
|---|---|
| Build Command | `cd frontend && npm install && npm run build` |
| Publish Directory | `frontend/dist` |

**Environment variables to set:**

| Variable | Value |
|---|---|
| `VITE_API_URL` | Your backend service URL, e.g. `https://your-backend.onrender.com` |

> **Important:** `VITE_API_URL` must be set **before the build runs** — Vite bakes it into the JavaScript bundle at compile time. If you change it, you must trigger a new deploy for it to take effect.

### Verify the deployment

Once both services are deployed, test the backend is reachable:

```
https://your-backend.onrender.com/api/health
```

This should return `{"status":"ok"}`. If you see "Cannot GET /api/health", the old code is still deployed — check your deploy logs.

### Free tier note

Render's free web service tier spins down after 15 minutes of inactivity. The first request after a period of inactivity may take 30–60 seconds while the service wakes up. Subsequent requests within that session are instant.
