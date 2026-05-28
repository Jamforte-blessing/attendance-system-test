# Attendance System

A full-stack employee attendance management system with a self-service kiosk for clock-in/out and an admin panel for managing employees, companies, departments, and reports.

---

## Features

**Employee Kiosk** (public, no login required)
- Select company, department, and name to clock in or out
- GPS geolocation validation — employees must be within the configured radius of the workplace
- Real-time clock display
- Visual confirmation screen on successful clock-in/out

**Admin Panel** (login required)
- **Dashboard** — live attendance feed and summary stats
- **Attendance Logs** — filterable table with manual entry support and record deletion
- **Employees** — add, edit, and deactivate employees; assign company, department, and shift hours
- **Companies** — manage companies with workplace GPS location and allowed clock-in radius
- **Departments** — managed per company
- **Reports** — attendance summary by period (day/week/month/custom) with CSV export
- **Settings** — configure work hours, late threshold, and timezone

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS v4, shadcn/ui, React Router DOM |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Auth | JWT (Bearer token) |

---

## Project Structure

```
/
├── frontend/          # React + Vite app
│   └── src/
│       ├── pages/     # Kiosk, Login, Dashboard, Attendance, Employees, Companies, Reports, Settings
│       ├── components/
│       └── api/       # Axios API client
└── backend/
    └── src/
        ├── app.js
        ├── database.js
        ├── routes/    # auth, kiosk, companies, departments, employees, attendance, reports, settings, dashboard
        └── middleware/
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Backend

```bash
cd backend
npm install
```

Create a `.env` file:

```env
PORT=5000
NODE_ENV=development

# Option 1 — connection string (Render, Railway, etc.)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Option 2 — individual fields
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=attendance_system

JWT_SECRET=your_jwt_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=yourpassword
```

```bash
npm run dev      # development (nodemon)
npm start        # production
```

The database tables are created automatically on first start.

### Frontend

```bash
cd frontend
npm install
```

Create a `.env` file:

```env
VITE_API_URL=http://localhost:5000
```

```bash
npm run dev      # development
npm run build    # production build
```

---

## Deployment (Render)

### Backend service

- **Environment**: Node
- **Build Command**: `cd backend && npm install`
- **Start Command**: `cd backend && npm start`
- Set all environment variables from the backend `.env` above

### Frontend service (Static Site)

- **Build Command**: `cd frontend && npm install && npm run build`
- **Publish Directory**: `frontend/dist`
- Set `VITE_API_URL` to your backend service URL

---

## Database Schema

| Table | Description |
|---|---|
| `companies` | Company records with GPS location and clock-in radius |
| `departments` | Departments linked to companies |
| `employees` | Employee profiles with shift hours and status |
| `attendance_logs` | Clock-in/out records with late and early-out flags |
| `settings` | Key-value store for system configuration |
| `leaves` | Leave records (approved/pending/rejected) |
| `audit_logs` | Admin action history |
