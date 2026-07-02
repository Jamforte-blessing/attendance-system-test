# Attendance System

A multi-tenant SaaS attendance management system. Employees clock in and out through a self-service kiosk with GPS geofencing and photo capture. Admins manage companies, employees, and reports through a protected panel.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS v4, shadcn/ui, Recharts |
| Backend | Node.js, Express |
| Database | PostgreSQL  |
| Auth | JWT (8h expiry) 
| Storage | Cloudinary (logos + clock-in photos) |
| Email | SendGrid (welcome + clock confirmation emails) |
| Hosting | Render (backend web service + frontend static site) |

---

## Features

- **Employee Kiosk** — public page where employees log in with email/password, clock in/out, and view their own attendance insights
- **GPS Geofencing** — employees must be within a configured radius of the workplace to clock in; auto-updates every 2 minutes when enabled
- **Photo Capture** — webcam photo taken at each clock event, stored in Cloudinary
- **Late/Early Detection** — compares clock times against each employee's shift schedule
- **Multi-tenant** — each company has its own admin, logo, employees, departments, and location
- **Reports & CSV Export** — summary and per-day reports, filterable by department/employee, exportable to CSV
- **Analytics** — charts for weekly trends, department attendance, and clock-in hour distribution
- **Admin Accounts** — super admin creates per-company admins with auto-generated passwords

---

## Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL

### Backend

```bash
cd backend && npm install
```

Create `backend/.env`:

```env
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/attendance_db
JWT_SECRET=any_random_string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=yourpassword
FRONTEND_URL=https://att.jamfortetech.com
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
SENDGRID_API_KEY=xxx        # optional — skip to disable emails
SENDGRID_FROM=noreply@yourapp.com
```

```bash
npm run dev   # nodemon
npm start     # production
```

Tables are created automatically on first start — no migrations to run.

### Frontend

```bash
cd frontend && npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000
```

```bash
npm run dev     # Vite dev server
npm run build   # builds to frontend/dist
```

---

## Deployment (Render)

### Backend — Web Service

| Setting | Value |
|---|---|
| Build Command | `cd backend && npm install` |
| Start Command | `cd backend && npm start` |

Required env vars: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `FRONTEND_URL=https://att.jamfortetech.com`, `NODE_ENV=production`, Cloudinary keys, SendGrid keys.

### Frontend — Static Site

| Setting | Value |
|---|---|
| Build Command | `cd frontend && npm install && npm run build` |
| Publish Directory | `frontend/dist` |

Required env var: `VITE_API_URL=https://jamfortetech.com/verifyin-api`

> `VITE_API_URL` is baked in at build time — changing it requires a redeploy.

Health check: `GET /api/health` → `{"status":"ok"}`

---

## Admin Access

The **super admin** is set via `ADMIN_USERNAME` / `ADMIN_PASSWORD`; `ADMIN_USERNAME` may be a conventional username or an email address. On every backend startup, that account is inserted into or updated in the `admins` table with a securely hashed password and `is_super_admin = TRUE`. Set `FRONTEND_URL=https://att.jamfortetech.com` to allow the deployed frontend through CORS and generate correct links. Additional per-company admins are created in **Settings → Admin Accounts** with a username, email, and assigned companies. Their generated credentials are shown after creation and sent through SendGrid to the supplied email address.

Kiosk route (`/kiosk`) is fully public. All other routes require a valid JWT.
