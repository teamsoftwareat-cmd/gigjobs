# Cynosurejobs.net — React App
### Cynosure Corporate Solutions | Chennai Gig Platform

A full-featured React.js portal for managing candidates, recruiters, clients, payroll, and admin operations for a gig workforce platform in Chennai.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| **React 18** | UI framework |
| **React Router v6** | Page routing |
| **Axios** | HTTP GET / POST / PUT / PATCH calls |
| **Zod** | Form validation schemas |
| **Chart.js + react-chartjs-2** | Analytics charts |
| **Font Awesome** | Icons |
| **Vite** | Dev server & build tool |

---

## Prerequisites

Make sure you have these installed before starting:

- **Node.js** version 18 or higher → https://nodejs.org
- **npm** version 8 or higher (comes with Node)

To check your versions, run:
```bash
node --version
npm --version
```

---

## Installation Steps

### Step 1 — Download & Extract
Unzip the project folder to any location on your computer.

### Step 2 — Open Terminal
Open your terminal (Mac/Linux) or Command Prompt / PowerShell (Windows).

Navigate into the project folder:
```bash
cd cynosurejobs
```

### Step 3 — Install Dependencies
Run this command to install all required packages:
```bash
npm install
```
This will download React, Axios, Zod, Chart.js, Font Awesome, and all other dependencies into a `node_modules` folder. It may take 1–2 minutes.

### Step 4 — Start the Development Server
```bash
npm run dev
```

You will see output like:
```
  VITE v5.x.x  ready in 500ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.x.x:3000/
```

### Step 5 — Open in Browser
Go to: **http://localhost:3000**

---

## Project Structure

```
cynosurejobs/
├── index.html                    # HTML entry point
├── vite.config.js                # Vite configuration
├── package.json                  # All dependencies
│
└── src/
    ├── main.jsx                  # React app entry point
    ├── App.jsx                   # Routes (React Router v6)
    │
    ├── styles/
    │   └── globals.css           # All CSS variables, dark mode, base styles
    │
    ├── api/
    │   └── axios.js              # Axios instance + all API endpoint functions
    │                               (authAPI, candidateAPI, jobsAPI, recruiterAPI,
    │                                clientAPI, accountsAPI, adminAPI, notificationsAPI)
    │
    ├── schemas/
    │   └── validations.js        # All Zod schemas for form validation
    │                               (loginSchema, registerSchema, candidateProfileSchema,
    │                                postJobSchema, invoiceSchema, addUserSchema, etc.)
    │
    ├── context/
    │   ├── AuthContext.jsx       # User auth state, login(), register(), logout()
    │   └── ThemeContext.jsx      # Dark/light mode toggle with localStorage
    │
    ├── components/
    │   ├── layout/
    │   │   ├── AppLayout.jsx     # Main app shell with Sidebar + Header + Outlet
    │   │   ├── Sidebar.jsx       # Navigation sidebar with role-based nav items
    │   │   └── Header.jsx        # Top header with search, dark mode, notifications
    │   │
    │   └── ui/
    │       ├── index.jsx         # Reusable components: Button, Card, Modal, StatCard,
    │       │                       Tag, FormField, DataTable, KanbanBoard, Tabs,
    │       │                       ProgressBar, Avatar, PageHeader
    │       ├── Charts.jsx        # Chart.js wrappers: EarningsBarChart, EarningsLineChart,
    │       │                       PlacementsChart, AttendanceDoughnut, RevenueChart, ManDaysChart
    │       ├── NotificationDropdown.jsx  # Bell icon + notification list with mark-read
    │       └── ResumeUpload.jsx  # Drag-and-drop resume uploader with progress bar
    │
    └── pages/
        ├── Landing.jsx           # Public landing page with role cards
        ├── auth/
        │   └── LoginModal.jsx    # Login + Register modal with Zod validation
        ├── candidate/
        │   ├── Dashboard.jsx     # Stats, calendar, quick actions, charts
        │   ├── Profile.jsx       # Editable profile + resume upload
        │   ├── Jobs.jsx          # Job browser + AI matching (Anthropic API)
        │   └── ApplicationsEarnings.jsx  # Applications table + Earnings/payouts
        ├── recruiter/
        │   └── index.jsx         # Dashboard (Kanban ATS, charts) + Candidate DB
        ├── client/
        │   └── index.jsx         # Dashboard + Attendance management + Post job modal
        ├── accounts/
        │   └── index.jsx         # Payroll dashboard + Invoice generator
        └── admin/
            └── index.jsx         # Admin overview + KYC queue + Settings
```

---

## Connecting a Real Backend

All API calls are in `src/api/axios.js`. The base URL defaults to:
```
https://api.Cynosurejobs.net/v1
```

To point it to your own backend, create a `.env` file in the project root:
```
VITE_API_URL=http://localhost:8000/api/v1
```

Then restart `npm run dev`.

### Available API functions

```js
// Auth
authAPI.login(data)            // POST /auth/login
authAPI.register(data)         // POST /auth/register

// Candidates
candidateAPI.getProfile(id)    // GET  /candidates/:id
candidateAPI.updateProfile(id) // PUT  /candidates/:id
candidateAPI.uploadResume(id)  // POST /candidates/:id/resume  (multipart)
candidateAPI.getEarnings(id)   // GET  /candidates/:id/earnings

// Jobs
jobsAPI.getAll(params)         // GET  /jobs
jobsAPI.apply(jobId, data)     // POST /jobs/:id/apply
jobsAPI.aiMatch(data)          // POST /jobs/ai-match

// Recruiter
recruiterAPI.getCandidates()   // GET  /recruiter/candidates
recruiterAPI.addCandidate(data)// POST /recruiter/candidates

// Client
clientAPI.postJob(data)        // POST /client/jobs
clientAPI.approveAttendance(id)// PATCH /client/attendance/:id/approve

// Accounts
accountsAPI.runPayroll(data)   // POST /accounts/payroll/run
accountsAPI.generateInvoice(d) // POST /accounts/invoices

// Admin
adminAPI.addUser(data)         // POST /admin/users
adminAPI.approveKyc(id)        // PATCH /admin/kyc/:id/approve
adminAPI.updateSettings(data)  // PUT  /admin/settings
```

---

## Zod Validation Schemas

Located in `src/schemas/validations.js`. Used in all modals and forms.

| Schema | Used In |
|--------|---------|
| `loginSchema` | Login modal |
| `registerSchema` | Register modal (includes password match check) |
| `candidateProfileSchema` | Profile page |
| `postJobSchema` | Post Job modal |
| `addCandidateSchema` | Add Candidate modal |
| `invoiceSchema` | Generate Invoice modal |
| `applyJobSchema` | Apply Job modal |
| `addUserSchema` | Add Staff User modal |

---

## Features Included

- **5 role-based dashboards** — Candidate, Recruiter, Client, Accounts, Admin
- **Login & Register** — Zod validation, password strength meter, show/hide password, role selector
- **Dark mode** — Toggle in header, persists across sessions via localStorage
- **Notifications** — Real-time unread count, mark individual/all as read
- **Resume Upload** — Drag-and-drop, file type + size validation, upload progress bar
- **AI Job Matching** — Calls Anthropic Claude API for smart job recommendations
- **Real Charts** — Chart.js bar, line, and doughnut charts across all dashboards
- **Kanban ATS Pipeline** — Recruiter pipeline with drag-and-drop-ready columns
- **Modals with validation** — All forms use Zod for server-ready validated data
- **Protected Routes** — App pages redirect to landing if not logged in

---

## Build for Production

To create an optimised production build:
```bash
npm run build
```

Output will be in the `dist/` folder. You can serve it with:
```bash
npm run preview
```

---

## Common Issues

**Port already in use?**
```bash
npm run dev -- --port 3001
```

**node_modules missing?**
```bash
rm -rf node_modules
npm install
```

**Fonts not loading?**
Ensure you have internet connection — Google Fonts loads from CDN.

---

*Built for Cynosurejobs.net — Cynosure Corporate Solutions, Chennai*
#   G i g j o b s 
 
 
