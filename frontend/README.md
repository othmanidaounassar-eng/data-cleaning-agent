# OQZARO Data Analysis Agent

A production-styled SaaS dashboard for uploading, validating, cleaning, and
reporting on datasets (CSV / Excel). Built with Next.js 16 (App Router),
TypeScript, Tailwind CSS, and Framer Motion. The upload flow talks to a
real FastAPI backend; authentication is a mock service ready to be swapped
for a real one.

## What's implemented

- **Auth pages** — `/login`, `/register`, `/forgot-password`,
  `/verify-email` (+ `success` / `expired`), all wired to a mock auth
  service via `hooks/use-auth.ts` (session persisted in `localStorage`)
- **Dashboard** — stats + charts (Recharts) with mock data
- **Upload flow** (`/dashboard/upload`) — the core product:
  - Drag & drop with format/size validation that never throws (limit comes
    from the current plan — 50 MB on Free, see `lib/billing/plans.ts`)
  - A validation dashboard (file type, size, headers, duplicate columns, encoding)
  - **Real upload** to the FastAPI backend's `POST /clean` (multipart/form-data),
    with live upload progress driving the existing animated pipeline visualization
  - Graceful error handling for network failures, timeouts, and backend
    errors, with a retry action — the app never crashes on a bad response
  - A quality-scored AI report (adapted from whatever shape the backend returns)
  - Download buttons for the cleaned dataset (via the backend's `download_url`,
    when provided) and PDF / JSON / CSV reports
- **Cleaning History** (`/dashboard/history`) — persisted in `localStorage`
- **Reports** (`/dashboard/reports`) — re-download any past report
- **Settings** (`/dashboard/settings`) — theme, language, export format, notifications, autosave
- **Support** (`/dashboard/support`) — contact form UI
- **Error boundaries** — `app/error.tsx`, `app/global-error.tsx`, and a
  dashboard-scoped `app/dashboard/error.tsx`

## Connecting to the FastAPI backend

Copy the env example and point it at your backend:

```bash
cp .env.local.example .env.local
# NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

`lib/api-client.ts` posts the raw file to `${NEXT_PUBLIC_API_BASE_URL}/clean`
using `XMLHttpRequest` (for real upload-progress events) and surfaces
network / timeout / server errors as a typed `ApiError`.

`lib/adapt-backend-report.ts` maps whatever JSON your backend returns into
the frontend's `CleaningReport` type. It's deliberately defensive: it
understands the nested `{"Cleaning Actions": ..., "Type Conversions": ...}`
shape produced by the Python cleaning agent in this repo, **and** flatter
snake_case / camelCase FastAPI payloads (`rows_before`, `rowsBefore`, etc.).
If your backend's field names differ, adjust the `pick(...)` key lists in
that one file — nothing else needs to change.

If the backend response includes a `download_url` (absolute or relative to
the API base), the download button on the report links straight to it.
Without one, the report/PDF/JSON/CSV-report downloads still work, but the
"Download Clean Dataset" button is disabled with an explanatory message.

> The original client-side cleaning engine (`lib/clean-data.ts`,
> `lib/generate-report.ts`, `lib/parse-file.ts`) is still in the repo and
> still used to populate the Dataset Information card before upload — it's
> just no longer what produces the final report. It's kept intact in case
> you want an offline/demo mode later.

## Mock authentication & future architecture

`lib/auth/` and `lib/billing/` define the shape of a real backend without
implementing one:

- `lib/auth/types.ts` — `User`, `AccountType`, `UserRole`, `AuthSession`, `AuthError`
- `lib/auth/mock-service.ts` — `login`, `register`, `requestPasswordReset`,
  `resendVerificationEmail`, `verifyEmailToken`, `logout` — same signatures
  a real API client would have, with simulated latency and validation errors
- `lib/billing/plans.ts` — `free` / `pro` / `business` / `enterprise` plan
  definitions (upload size limits, file quotas, feature lists)
- `hooks/use-auth.ts` — the one place that calls the mock service; swap its
  internals for real `fetch`/API calls later and no page needs to change

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000 — it redirects to `/dashboard`. Start your
FastAPI backend on port 8000 (or update `.env.local`) before using the
upload page.

> This project was authored without network access, so dependencies have
> **not** been installed or build-tested in this environment. Run
> `npm install` and `npm run build` locally; if anything surfaces a type
> error, it's most likely a version mismatch in `package.json` — pin the
> exact versions listed there first.

## Project structure

```
app/
  (auth)/login, register, forgot-password,
         verify-email, verify-email/success,
         verify-email/expired                → auth pages + shared layout
  dashboard/                                  → sidebar-wrapped app pages
  api/                                        → stub routes for future backend
  error.tsx, global-error.tsx                 → error boundaries
components/
  ui/            → Button (with loading state), Card, Badge, Progress, Input,
                    Select, Switch, Checkbox, RadioGroup
  dashboard/     → Sidebar, Topbar, StatCard, charts
  upload/        → Dropzone, ValidationDashboard, CleaningPipeline,
                    CleaningReport, DownloadSection, UploadErrorState
lib/
  validate-file.ts        → Stage 1 + 2 validation (extension, size, headers, duplicates…)
  parse-file.ts           → CSV (papaparse) / Excel (xlsx) parsing (dataset info preview)
  clean-data.ts           → legacy client-side cleaning engine (kept, unused by default)
  generate-report.ts      → legacy report builder (kept, unused by default)
  api-client.ts           → POSTs to the FastAPI /clean endpoint with progress + typed errors
  adapt-backend-report.ts → maps the backend's JSON into the frontend's CleaningReport type
  export-utils.ts         → CSV / JSON / CSV-report / PDF downloads
  history-store.ts        → localStorage-backed history
  auth/                   → types.ts + mock-service.ts
  billing/                → plans.ts (Free / Pro / Business / Enterprise)
hooks/
  use-cleaning-pipeline.ts → orchestrates validate → upload → adapt-report flow
  use-auth.ts              → login / register / reset / resend, backed by the mock service
```

## Design system

- **Palette**: near-black navy base (`#0B0E16`) with a blue → violet gradient
  accent (`#4F7CFF` → `#8B5CF6`), glass panels (`bg-white/5` + backdrop-blur).
- **Type**: Space Grotesk for display/headings, Inter for body text,
  JetBrains Mono for stats and data values.
- **Signature element**: the animated pipeline visualization on the upload
  page — a flowing gradient line connecting each cleaning stage as it
  transitions from waiting → running → completed.

## Known gaps / next steps

- Replace `lib/auth/mock-service.ts` with real calls to your auth backend
  (NextAuth, Clerk, or a custom API) — `hooks/use-auth.ts` already has the
  right shape, so pages shouldn't need to change
- `app/api/*` routes are still `501` stubs — useful if you want a Next.js
  API layer in front of FastAPI instead of calling it directly from the browser
- If your FastAPI `/clean` response doesn't include a `download_url`, the
  "Download Clean Dataset" button stays disabled — either add that field on
  the backend, or extend `adapt-backend-report.ts` to accept the cleaned
  rows directly and reuse `downloadCleanedCsv`
- Add automated tests (the adapter in `lib/adapt-backend-report.ts` and the
  legacy engine in `lib/clean-data.ts` are both pure functions, easy to unit test)
- Excel export (`.xlsx`) for the cleaned dataset — currently CSV / whatever
  the backend's `download_url` serves
