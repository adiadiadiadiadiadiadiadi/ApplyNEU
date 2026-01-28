## ApplyNEU

Electron-wrapped React app that automates co-op/job applications against Northeastern’s NUWorks portal. It uses a Vite/React frontend (rendered inside an Electron webview) and a TypeScript/Express backend that handles job parsing, task creation, and document handling.

### Project layout
- `frontend/` – Vite + React UI (Automation panel, login/onboarding flows).
- `backend/` – Express API (TS) on port 8080: users, jobs, resumes, tasks.
- `electron/` – Desktop shell that loads the frontend (dev: http://localhost:5173; prod: built assets).
- `package.json` (root) – Dev convenience scripts to run Electron + Vite together.

### Prerequisites
- Node 18+ and npm.
- Postgres instance for backend persistence.
- AWS creds + S3 bucket for resume storage (see env vars).
- Supabase project for auth (frontend uses Supabase).

### Environment variables
Create a `.env` in `backend/` with at least:
```
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
DB_HOST=...
DB_PORT=5432
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=...
ANTHROPIC_API_KEY=...       # required for AI-assisted parsing
```

Create a `.env` in `frontend/` with:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Install
```bash
# from repo root
npm install          # installs electron + helper deps
cd backend && npm install
cd ../frontend && npm install
```

### Run in development
Term 1 – backend API (port 8080):
```bash
cd backend
npm run dev
```

Term 2 – frontend + Electron shell:
```bash
# from repo root
npm run dev
```
This starts Vite on 5173 and launches Electron pointed at it.

### Build
Frontend bundle:
```bash
cd frontend
npm run build
```
Electron will load `frontend/dist` in production mode.

### Key paths/components
- `frontend/src/components/Automation/automation.tsx` – main automation flow (cover letters, resumes, work samples, portfolio handling).
- `backend/controller/*.ts` – REST endpoints mounted under `/users`, `/jobs`, `/resumes`, `/tasks`.
- `backend/services/*.ts` – business logic (S3, Anthropic, PDF parsing, task creation).

### Notes
- Backend listens on `http://localhost:8080`; frontend web requests (tasks, users, jobs) point there.
- Electron dev CSP is relaxed to allow NUWorks to load inside the webview.
