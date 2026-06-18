# Business Logic Separation — Step-by-Step Refactoring

## Phase 1: Backend — Auth Module (easiest, quick win)

### Task 1: Create `backend/src/modules/auth/auth.service.ts`
Extract login logic and getCurrentUser from `auth.routes.ts`:
- `login(login, password)` — DB query + bcrypt.compare + jwt.sign (lines 20-57)
- `getCurrentUser(creatorId)` — DB query (lines 59-75)

### Task 2: Slim down `backend/src/modules/auth/auth.routes.ts`
Each handler becomes ~3 lines: parse req -> call service -> send response.

---

## Phase 2: Backend — Experts Module

### Task 3: Create `backend/src/modules/experts/experts.service.ts`
Extract CRUD + ownership checks:
- `listExperts(creatorId)` — DB query
- `createExpert(creatorId, data)` — DB insert
- `getOwnedExpert(creatorId, expertId)` — fetch + ownership check (currently duplicated in PATCH and DELETE handlers, lines 73-86 and 110-123)
- `updateExpert(creatorId, expertId, data)` — uses getOwnedExpert internally
- `deleteExpert(creatorId, expertId)` — uses getOwnedExpert internally

### Task 4: Slim down `backend/src/modules/experts/experts.routes.ts`
Each handler becomes ~3 lines.

---

## Phase 3: Backend — Reports Module (biggest, most critical)

### Task 5: Create `backend/src/modules/reports/reports.repository.ts`
Extract all data-access functions:
- `getOwnedReport(reportId, creatorId)` — from lines 65-77
- `getReportUpdatePayload(data)` — from lines 79-113
- `replaceStep4Collections(tx, reportId, data)` — from lines 123-184
- `listReports(creatorId, query)` — from lines 383-437 (search + pagination)
- `getReportWithCollections(id)` — from lines 439-463
- `createReport(creatorId, data)` — from lines 186-228
- `saveStep2/3/4/5(id, creatorId, data)` — from step handlers
- `autosave(id, creatorId, payload)` — from lines 338-381
- `deleteReport(id, creatorId)` — from lines 465-483
- `getStep4Collections(id)` — fetch all 4 related tables
- `updateReportStatus(id, creatorId, status, grandTotal)` — from lines 580-588

### Task 6: Create `backend/src/modules/reports/reports.service.ts`
Extract business logic:
- `validateCompleteness(report)` — lines 493-523 (20+ field checks)
- `calculateTotals(report, collections)` — lines 552-578 (financial formulas)
- `finalizeAndGenerate(creatorId, reportId)` — orchestrates: validate -> fetch collections -> verify expert -> calculate totals -> update status -> generate doc -> save file
- `getGeneratedReportFilename()` — from lines 57-63
- Photo methods: `uploadPhotos()`, `deletePhoto()`, `listPhotos()`, `getPhotoFile()`

### Task 7: Create `backend/src/shared/services/storage.service.ts`
Extract file I/O:
- `ensureDirectory(dirPath)`
- `writeFile(filePath, data)`
- `deleteFile(filePath)`
- `fileExists(filePath)`
- `getUploadsDir()` / `getPhotosDir()` / `getTemplatesDir()`

### Task 8: Add path config to `backend/src/config/env.ts`
Add `UPLOAD_DIR` and `TEMPLATE_DIR` env vars with sensible defaults, replacing fragile relative paths in `upload.ts`, `reports.routes.ts`, `admin.routes.ts`, and `docGenerator.ts`.

### Task 9: Slim down `backend/src/modules/reports/reports.routes.ts`
Reduce from 807 lines to ~120 lines. Each handler: parse req -> call service -> send response.

---

## Phase 4: Backend — Admin Module

### Task 10: Create `backend/src/modules/admin/admin.service.ts`
Extract:
- `listAllReports(query)` — reuse shared report query logic (currently duplicated with reports.routes.ts)
- `getReportDetails(reportId)` — lines 90-115
- `listCreators()` — lines 118-129
- `getTemplateInfo()` — lines 132-148
- `uploadTemplate(base64Data)` — lines 151-163

### Task 11: Slim down `admin.routes.ts` + fix error handling
- Replace `res.status(404).json()` with `throw notFound()` for consistency
- Replace `res.status(400).json()` with proper validation middleware or `throw badRequest()`

---

## Phase 5: Backend — Cross-Cutting Cleanup

### Task 12: Clean schema duplication
- `auth.schemas.ts`: keep only `loginSchema`, remove dead expert schemas
- `experts.schemas.ts`: keep only expert schemas, remove dead `loginSchema`

---

## Phase 6: Frontend — Service Layer Split

### Task 13: Split `frontend/src/services/reportService.ts` (274 lines) into:
- `services/reportService.ts` — report CRUD only
- `services/expertService.ts` — expert CRUD
- `services/photoService.ts` — photo upload/delete/list
- `services/documentService.ts` — finalize + download
- `services/adminService.ts` — admin endpoints
- `utils/download.ts` — generic blob download helper

### Task 14: Update all frontend import references after the split

---

## Phase 7: Frontend — Extract Validators

### Task 15: Create `frontend/src/utils/validators.ts`
Extract domain validation rules from Step1-Step5 components into:
- `validateStep1(data)`, `validateStep2(data)`, `validateStep3(data)`, `validateStep4(data)`, `validateStep5(data)`

### Task 16: Update Step components to use the extracted validators

---

## Phase 8: Frontend — Extract Hooks from God Components

### Task 17: Extract from `Step1.tsx` (364 lines)
- Create `frontend/src/hooks/useExperts.ts` — expert CRUD + loading/error state
- Create `frontend/src/components/ExpertManagerModal.tsx` — modal UI
- Step1 becomes a thin form (~120 lines)

### Task 18: Extract from `Step4.tsx` (308 lines)
- Create `frontend/src/hooks/useEditableList.ts` — generic add/update/remove hook
- Create `frontend/src/hooks/useStep4Logic.ts` — orchestrates 4 lists + hourly rate recalc
- Step4 becomes pure UI

### Task 19: Extract from `Step5.tsx` (254 lines)
- Create `frontend/src/hooks/usePhotoUpload.ts` — upload, delete, validation, drag-drop
- Step5 becomes pure gallery UI + totals display

### Task 20: Extract from `ReportPage.tsx` (282 lines)
- Create `frontend/src/hooks/useReportWizard.ts` — step navigation, state machine
- Create `frontend/src/hooks/useReportAutosave.ts` — debounced autosave
- Create `frontend/src/hooks/useReportFinalize.ts` — finalize + download + success flow
- ReportPage becomes a thin layout shell

### Task 21: Extract from `AdminPage.tsx` (461 lines)
- Create `frontend/src/components/admin/AdminReportsTab.tsx`
- Create `frontend/src/components/admin/AdminCreatorsTab.tsx`
- Create `frontend/src/components/admin/AdminTemplateTab.tsx`
- Move admin types to `src/types/`
- AdminPage becomes a tab router (~30 lines)

---

## Phase 9: Frontend — Dedup + Cleanup

### Task 22: Create shared utilities
- `frontend/src/utils/formatters.ts` — `formatDate()`, `formatSum()`, `formatProgress()`
- `frontend/src/components/StatusBadge.tsx` — shared status pill component
- Consolidate auth: remove manual `localStorage` calls scattered across Login, Dashboard, AdminPage, api.ts — all token management goes through `useAuthStore` exclusively

### Task 23: Update Dashboard.tsx to use shared components (StatusBadge, formatters)

---

## Execution Order
Tasks 1-12 (backend) first, then 13-23 (frontend). Each task is independently verifiable via `npm run build` / `npm run lint`.
