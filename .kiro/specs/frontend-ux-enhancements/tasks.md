# Implementation Plan: Frontend UX Enhancements

## Overview

План реализует пять связанных улучшений UX/производительности AvtoExpert Pro:

1. **Sonner-уведомления** (Req 5) и **Global Loading Manager + overlay** (Req 4) сначала — это общая инфраструктура, на которую опираются остальные требования.
2. **Конфигурируемый автосейв 60 с** (Req 3) — использует `notify` для ошибок (AC 3.9) и флаг `background` axios (AC 4.4).
3. **Отзывчивость поиска на Dashboard** (Req 1) — рефакторинг с `placeholderData: keepPreviousData` и `notify` для ошибок (AC 1.9).
4. **Миграция остальных `AppAlert`** (Req 5, продолжение) — Login, Wizard, Admin.

Каждая задача-имплементация ссылается на конкретные ACs. Property-based tests аннотированы номером свойства из `design.md` и ACs, которые они проверяют.

Convert the feature design into a series of prompts for a code-generation LLM that will implement each step with incremental progress. Make sure that each prompt builds on the previous prompts, and ends with wiring things together. There should be no hanging or orphaned code that isn't integrated into a previous step. Focus ONLY on tasks that involve writing, modifying, or testing code.

## Tasks

- [x] 1. Set up Sonner toast infrastructure
  - [x] 1.1 Install `sonner` and create shadcn `Toaster` wrapper
    - Добавить `sonner@^1.5.0` в `frontend/package.json` dependencies
    - Создать `frontend/src/components/ui/sonner.tsx`, экспортирующий обёртку `Toaster` с `position="bottom-right"`, `richColors`, `closeButton`, `visibleToasts={3}`, `expand={false}`
    - _Requirements: 5.2, 5.9, 5.10, 5.14, 5.15_

  - [x] 1.2 Implement HTTP error message sanitization
    - Создать `frontend/src/shared/api/error-mapping.ts` с функцией `sanitizeErrorMessage(error: AxiosError): string`
    - Извлекать `data.message` / `data.error` / `error.message`, удалять стек-трейсы (`\bat\s+\S+\s+\([^)]+\)`) и UUID v4, обрезать до 200 символов, возвращать fallback `"Произошла ошибка. Попробуйте ещё раз."` при пустом результате
    - _Requirements: 5.12_

  - [ ]* 1.3 Write property test for error sanitization
    - **Property 16: Error message sanitization**
    - **Validates: Requirement 5.12**
    - Файл `frontend/src/shared/api/__tests__/error-mapping.property.test.ts`; `fast-check` arbitrary строк с инжектируемыми стек-трейсами и UUID; assert длина ≤ 200, отсутствие совпадений с обоими regex, fallback для пустой строки

  - [x] 1.4 Implement `notify` public API
    - Создать `frontend/src/shared/notifications/notify.ts` с объектом `notify` и методами `success`, `error`, `info`, `warning`
    - Валидировать длину `message ∈ [1, 200]`, `title ∈ [1, 80]`, `description ∈ [1, 200]`; бросать `RangeError` при нарушении
    - Передавать `duration: 5000` для success/info и `duration: 8000` для error/warning в `toast.*`
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.13_

  - [ ]* 1.5 Write property test for notify input validation
    - **Property 14: Notify API input validation**
    - **Validates: Requirements 5.1, 5.13**
    - Файл `frontend/src/shared/notifications/__tests__/notify.validation.property.test.ts`; для каждой severity и пары `(message, title?, description?)` проверить, что валидные длины не бросают исключения, невалидные бросают `RangeError`

- [x] 2. Implement Global Loading Manager
  - [x] 2.1 Create `useGlobalLoadingStore`
    - Создать `frontend/src/shared/loading/useGlobalLoadingStore.ts`: zustand store с полями `pendingRequests: number`, `isNavigationPending: boolean`, `activeSince: number | null`, `lastWarnedIncidentId: string | null`
    - Реализовать actions `incrementRequests`, `decrementRequests` (clamp at 0), `startNavigation`, `endNavigation`
    - Экспортировать селектор `selectIsActive(s) := s.pendingRequests > 0 || s.isNavigationPending`
    - _Requirements: 4.1, 4.3, 4.6_

  - [x] 2.2 Add axios config augmentation
    - Создать `frontend/src/shared/api/axios.augmentations.d.ts` с module augmentation `declare module "axios"`, добавляющим необязательные поля `background?: boolean` и `silent?: boolean` в `AxiosRequestConfig`
    - _Requirements: 4.4, 5.12_

  - [x] 2.3 Wire request/response interceptors to store and notify
    - Изменить `frontend/src/shared/api/client.ts`: в request-interceptor вызвать `incrementRequests()`, только если `!config.background`
    - В response-interceptor (success и error ветки) вызвать `decrementRequests()`, только если `!config.background`; **decrement должен выполняться до** проверки 401/redirect и до возврата ошибки
    - При ошибке без `silent` и без `background` вызвать `notify.error(sanitizeErrorMessage(error))`
    - _Requirements: 4.2, 4.3, 4.4, 4.13, 5.12_

  - [ ]* 2.4 Write property test for global loading counter invariant
    - **Property 10: Global loading counter invariant**
    - **Validates: Requirements 4.2, 4.3, 4.6, 4.13**
    - Файл `frontend/src/shared/loading/__tests__/globalLoading.counter.property.test.ts`; `fc.commands` model-based testing с операциями `initiate(id, background?)`, `complete(id, outcome)`; oracle = ожидаемое значение счётчика

  - [ ]* 2.5 Write property test for background requests no-op
    - **Property 11: Background requests do not affect counter**
    - **Validates: Requirement 4.4**
    - Файл `frontend/src/shared/loading/__tests__/globalLoading.background.property.test.ts`; arbitrary последовательностей запросов с произвольными значениями `background`; assert, что счётчик меняется только для non-background

  - [x] 2.6 Create `GlobalLoadingOverlay` component
    - Создать `frontend/src/components/ui/global-loading-overlay.tsx`; подписаться на `selectIsActive`
    - Использовать локальный `setTimeout(setVisible(true), 200)` для активации; немедленно сбрасывать на `false` при переходе active→inactive
    - Рендерить `<div role="alert" aria-busy="true" aria-live="polite" />` поверх viewport с центрированным `<Loader2 />`; перехватывать `click`, `keydown`, `pointerdown`, `touchstart`, `keyup`, `pointerup`, `touchend` через `e.preventDefault()`
    - Через `useEffect` при `isVisible` устанавливать атрибут `inert` на `#root` (или `<main>`) и снимать при размонтировании/скрытии
    - _Requirements: 4.7, 4.8, 4.9, 4.10_

  - [ ]* 2.7 Write property test for overlay 200ms debounce
    - **Property 13: Overlay 200ms debounce**
    - **Validates: Requirement 4.9**
    - Файл `frontend/src/components/ui/__tests__/global-loading-overlay.debounce.property.test.tsx`; fake timers, arbitrary длительности активного состояния 0..400 мс; assert overlay в DOM ⇔ длительность ≥ 200 мс

  - [ ]* 2.8 Write property test for overlay event blocking
    - **Property 12: Overlay blocks pointer/keyboard events**
    - **Validates: Requirement 4.7**
    - Файл `frontend/src/components/ui/__tests__/global-loading-overlay.events.property.test.tsx`; arbitrary типа события из `{click, keydown, pointerdown, touchstart, keyup, pointerup, touchend}`; rendered overlay + button под ним; assert, что обработчик кнопки не вызывается, и Tab не переводит фокус под overlay

  - [x] 2.9 Implement `useGlobalNavigate` and `NavigationWatcher`
    - Создать `frontend/src/shared/loading/useGlobalNavigate.ts`: хук, оборачивающий `useNavigate`; на вызов делать `startNavigation()` и запускать hard-таймаут `setTimeout(endNavigation, 5000)`
    - Создать компонент `NavigationWatcher` (тот же файл или соседний), использующий `useLocation` и `useEffect([pathname])` для вызова `endNavigation()` на mount нового route
    - _Requirements: 4.5_

  - [x] 2.10 Implement diagnostic watchdog (>30s warning)
    - Создать `frontend/src/shared/loading/diagnostic-watchdog.ts`: подписаться на `useGlobalLoadingStore.subscribe` через `selectIsActive`
    - На переходе inactive→active запустить `setTimeout(30000)`; на срабатывании, если всё ещё active и `lastWarnedIncidentId === null`, выполнить `console.warn` с `pendingRequests` и сгенерированным id, записать id в стор; на переходе active→inactive отменить таймер и сбросить `lastWarnedIncidentId`
    - _Requirements: 4.12_

- [x] 3. Integrate Toaster, overlay and styles in App root
  - [x] 3.1 Mount `<Toaster />`, `<GlobalLoadingOverlay />`, `<NavigationWatcher />` in `App.tsx`
    - В `frontend/src/App.tsx` добавить один экземпляр `<Toaster />`, один `<GlobalLoadingOverlay />` и `<NavigationWatcher />` внутри `<BrowserRouter>` рядом с `<AppRouter />`
    - Импортировать `diagnostic-watchdog` (side-effect import), чтобы подписка активировалась при загрузке приложения
    - _Requirements: 4.11, 5.2_

  - [x] 3.2 Add Sonner responsive position styles
    - В `frontend/src/index.css` добавить media-query `@media (max-width: 639px)` для `:where([data-sonner-toaster])`, перемещающую тостер в верх viewport (десктоп остаётся `bottom-right`, заданным в Toaster props)
    - _Requirements: 5.14_

  - [ ]* 3.3 Write example tests for Toaster singleton, position, severities, durations, close affordance
    - Файлы в `frontend/src/components/ui/__tests__/`: `Toaster.singleton.test.tsx`, `Toaster.position.test.tsx`, `Toaster.close-affordance.test.tsx`, `frontend/src/shared/notifications/__tests__/notify.severity.test.tsx`, `notify.duration.test.ts`
    - Проверить: один экземпляр Toaster в DOM, позиция меняется при матчмедиа width < 640, four severities вызывают соответствующие toasts через 300 мс, длительность 5000/8000 мс, кнопка закрытия видима и имеет `aria-label`
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.14_

- [x] 4. Checkpoint - shared infrastructure
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement configurable autosave (60s interval)
  - [x] 5.1 Create autosave config module
    - Создать `frontend/src/features/reports/lib/autosave.config.ts` с экспортами `AUTOSAVE_INTERVAL_MS = 60_000` и `AUTOSAVE_ELIGIBLE_STEPS = [2, 3, 4] as const`
    - Документировать допустимый диапазон [1000, 600000] мс
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 5.2 Extend `reportService.autosave` signature with optional axios config
    - В `frontend/src/features/reports/api/reportApi.ts` изменить сигнатуру `autosave(id, payload, config?: { background?: boolean; silent?: boolean })` и передавать `config` в `apiClient.patch`
    - _Requirements: 4.4_

  - [x] 5.3 Refactor `useReportAutosave` to use constant, background flag and notify
    - В `frontend/src/features/reports/hooks/useReportAutosave.ts` импортировать `AUTOSAVE_INTERVAL_MS`, `AUTOSAVE_ELIGIBLE_STEPS`; удалить числовой литерал `30_000` и любые другие литералы задержки
    - Реализовать guard `if (!reportId || !AUTOSAVE_ELIGIBLE_STEPS.includes(currentStep)) return` до планирования `setTimeout`; cleanup отменяет таймер при смене deps
    - Вызывать `reportService.autosave(reportId, snapshot, { background: true })` (snapshot создаётся без мутаций стора)
    - В catch вызывать `notify.error("Не удалось сохранить черновик", { description: "Изменения сохранены локально и будут отправлены при следующем автосейве." })`; не трогать `useFormStore`
    - Возвращать `{ isSaving }`; устанавливать `true` перед запросом, `false` в `finally`
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [ ]* 5.4 Write property test for autosave timer uniqueness and exact firing
    - **Property 5: Autosave timer uniqueness and exact firing**
    - **Validates: Requirements 3.1, 3.5, 3.6**
    - Файл `frontend/src/features/reports/hooks/__tests__/useReportAutosave.timing.property.test.ts`; fake timers; arbitrary последовательностей правок step2/step3/step4 с разными интервалами; assert не более одного активного таймера и ровно один вызов `reportService.autosave` после `AUTOSAVE_INTERVAL_MS` тишины

  - [ ]* 5.5 Write property test for autosave gating
    - **Property 6: Autosave gating**
    - **Validates: Requirement 3.4**
    - Файл `frontend/src/features/reports/hooks/__tests__/useReportAutosave.gating.property.test.ts`; arbitrary `{reportId: option, currentStep: integer}`; assert `setTimeout` не вызывается, когда хук в недопустимом состоянии

  - [ ]* 5.6 Write property test for `isSaving` round-trip
    - **Property 7: isSaving round-trip**
    - **Validates: Requirements 3.7, 3.8**
    - Файл `frontend/src/features/reports/hooks/__tests__/useReportAutosave.isSaving.property.test.ts`; controllable promise; arbitrary outcome (success / 4xx / 5xx / network); assert `isSaving === true` в процессе и `false` после resolve/reject

  - [ ]* 5.7 Write property test for autosave error → notify
    - **Property 8: Autosave error → notify**
    - **Validates: Requirement 3.9**
    - Файл `frontend/src/features/reports/hooks/__tests__/useReportAutosave.error-notify.property.test.ts`; arbitrary outcome ошибки; spy на `notify.error`; assert один вызов с непустым сообщением длины ≤ 200

  - [ ]* 5.8 Write property test for store immutability on error
    - **Property 9: Autosave error preserves form store**
    - **Validates: Requirement 3.10**
    - Файл `frontend/src/features/reports/hooks/__tests__/useReportAutosave.store.property.test.ts`; snapshot `useFormStore.getState()` до запроса; arbitrary error outcome; assert deep equality полей step2/step3/step4 после завершения

  - [ ]* 5.9 Write example tests for single source of truth and init-time value
    - Файлы `frontend/src/features/reports/lib/__tests__/autosave-config.singleton.test.ts` и `useReportAutosave.init.test.ts`
    - Singleton: grep `frontend/src/**/*.{ts,tsx}` (исключая `autosave.config.ts` и тестовые файлы) на наличие литералов `60000`/`60_000` рядом со словами `autosave|interval`; assert список совпадений пуст
    - Init: assert хук планирует таймер ровно на текущее значение `AUTOSAVE_INTERVAL_MS` в момент монтирования
    - _Requirements: 3.2, 3.3_

- [x] 6. Restore Dashboard search responsiveness
  - [x] 6.1 Add `placeholderData: keepPreviousData` to `useReportsQuery`
    - В `frontend/src/features/reports/model/reportQueries.ts` импортировать `keepPreviousData` из `@tanstack/react-query` и передать в опции `useQuery`
    - _Requirements: 1.1, 1.2, 1.7_

  - [x] 6.2 Derive `isInitialLoading` in `useDashboard`
    - В `frontend/src/features/reports/hooks/useDashboard.ts` добавить `isInitialLoading = reportsQuery.isLoading && !reportsQuery.data` в возвращаемое значение; сохранить существующий `isLoading` для обратной совместимости
    - _Requirements: 1.5, 1.7, 1.8_

  - [x] 6.3 Extract `DashboardSearchBar` component
    - Создать `frontend/src/features/reports/ui/DashboardSearchBar.tsx`, инкапсулирующий `<Input {...register("search")} data-testid="dashboard-search-input" />`, кнопку очистки, и спиннер `<Loader2 />`, контролируемый пропсом `isFetching`
    - Корневой `<section data-testid="dashboard-search-bar">`; никаких условных размонтирований input внутри
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [x] 6.4 Extract `DashboardTableArea` component
    - Создать `frontend/src/features/reports/ui/DashboardTableArea.tsx`; принимает пропсы `isInitialLoading`, `error`, `reports`, `pagination`, `currentPage`, `onPageChange`, `onDelete`, `isDeletePending`
    - Внутри одной `<section data-testid="dashboard-list-area">` рендерит skeleton, inline-ошибку, empty-state или таблицу — но не header и не search bar
    - _Requirements: 1.5, 1.8, 5.11_

  - [x] 6.5 Refactor `Dashboard.tsx`: remove early returns and migrate transient `AppAlert`
    - Удалить ранние `return` для `isLoading` и `error && reports.length === 0`; рендерить header, `<DashboardSearchBar />`, `<DashboardTableArea />` в стабильной структуре дерева
    - В `useEffect` на `location.state.justGenerated` вызывать `notify.success("Заключение успешно сгенерировано")` и очищать состояние; удалить локальный таймер 5 c
    - В `useEffect` на изменение `reportsQuery.isError` (когда `reports.length > 0` ИЛИ `isFetching` после предыдущих данных) вызывать `notify.error(sanitizeErrorMessage(reportsQuery.error))`; передавать ошибки axios silent для запросов, ошибки которых обрабатываются локально, чтобы не дублировать (через config `silent: true` в `useReportsQuery`, если требуется)
    - Удалить inline `<AppAlert type="error" />` после search bar; persistent error блок (когда `reports.length === 0`) перенести внутрь `DashboardTableArea`
    - _Requirements: 1.1, 1.2, 1.3, 1.7, 1.8, 1.9, 5.3, 5.4, 5.11_

  - [ ]* 6.6 Write property test for Search_Input mount stability
    - **Property 1: Dashboard Search_Input mount stability**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.7, 1.8**
    - Файл `frontend/src/features/reports/ui/__tests__/Dashboard.search.property.test.tsx`; arbitrary последовательности `{setQueryState, typeChar, focus, setCaret}`; assert тот же DOM-узел (по ссылке), `disabled === false`, `readOnly === false`, неизменная позиция каретки при недиктуемых пользователем переходах состояния

  - [ ]* 6.7 Write property test for skeleton scope during initial load
    - **Property 2: Skeleton scope during initial load**
    - **Validates: Requirement 1.5**
    - Файл `frontend/src/features/reports/ui/__tests__/Dashboard.skeleton.property.test.tsx`; arbitrary `{reportsCount, paginationTotal}`; assert skeleton отсутствует внутри `data-testid="dashboard-search-bar"` и `dashboard-header`, присутствует только внутри `dashboard-list-area`

  - [ ]* 6.8 Write property test for synchronous keystroke reflection
    - **Property 3: Keystroke reflected in DOM synchronously**
    - **Validates: Requirement 1.6**
    - Файл `frontend/src/features/reports/ui/__tests__/Dashboard.input-sync.property.test.tsx`; `fc.unicodeString` 1..1024; ввод посимвольно через `userEvent.type`; sync-чтение `inputEl.value` сразу после события

  - [ ]* 6.9 Write property test for Reports_Query error → notify
    - **Property 4: Reports_Query error forwarded to Notification_System**
    - **Validates: Requirement 1.9**
    - Файл `frontend/src/features/reports/ui/__tests__/Dashboard.error-notify.property.test.tsx`; msw rejects с arbitrary сообщением; spy на `notify.error`; assert один вызов

  - [ ]* 6.10 Write example test for fetch indicator hide ≤ 100ms
    - Файл `frontend/src/features/reports/ui/__tests__/Dashboard.indicator-hide.test.tsx`; fake timers; trigger refetch resolve; assert `<Loader2 />` исчезает в течение ≤ 100 мс
    - _Requirements: 1.4_

- [x] 7. Checkpoint - autosave and Dashboard
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Migrate remaining `AppAlert` call sites to toast notifications
  - [x] 8.1 Migrate `Login.tsx` transient error
    - В `frontend/src/features/auth/ui/Login.tsx` заменить `<AppAlert type="error" ... />` на вызов `notify.error(errorMessage)` в обработчике `loginMutation.onError`
    - При вызове `loginMutation.mutate` использовать `{ silent: true }` в axios config, чтобы interceptor не дублировал toast
    - _Requirements: 5.4, 5.12_

  - [x] 8.2 Migrate `ExpertManagerModal.tsx` expert error
    - В `frontend/src/features/.../ExpertManagerModal.tsx` (точный путь — см. design §3.5) заменить inline `<AppAlert type="error" />` на `useEffect` с `notify.error(expertError)` при появлении `expertError`
    - _Requirements: 5.4_

  - [x] 8.3 Migrate `Step1.tsx` transient error
    - В `frontend/src/features/reports/ui/Step1.tsx` заменить `<AppAlert type="error" />` на `notify.error(error)`; локальное обнуление `setError(null)` сохранить
    - _Requirements: 5.4_

  - [x] 8.4 Migrate `Step5.tsx` upload error, generate error and generate success
    - В `frontend/src/features/reports/ui/Step5.tsx` заменить три `<AppAlert>` (uploadError, generateError, generateSuccess) на `notify.error(uploadError)`, `notify.error(generateError)`, `notify.success("Документ успешно сгенерирован и скачан!")`
    - Inline `<AppAlert type="info" message="Заполните шаг 4 для просмотра итогов">` оставить как Persistent_Status_Message
    - _Requirements: 5.3, 5.4, 5.11_

  - [x] 8.5 Migrate `ReportPage.tsx` transient mutation errors
    - В `frontend/src/features/reports/ui/ReportPage.tsx` удалить inline `<AppAlert type="error">` для `mutationError` — он покрывается interceptor'ом + `notify.error` (AC 5.12)
    - Persistent inline `<AppAlert>` для ошибки загрузки страницы (когда отчёт не найден) оставить
    - При локальной обработке ошибок mutation использовать `{ silent: true }`, чтобы избежать двойного toast
    - _Requirements: 5.4, 5.11, 5.12_

  - [ ]* 8.6 Write property test for toast stack independence
    - **Property 15: Toast stack independence**
    - **Validates: Requirement 5.10**
    - Файл `frontend/src/shared/notifications/__tests__/notify.stack.property.test.tsx`; spawn 2..3 toasts с произвольными severity; close один; assert остальные не закрываются и их таймеры не сдвигаются

  - [ ]* 8.7 Write property test for toast queue cap and FIFO eviction
    - **Property 17: Toast queue cap and FIFO eviction**
    - **Validates: Requirement 5.15**
    - Файл `frontend/src/shared/notifications/__tests__/notify.queue.property.test.tsx`; spawn n > 3 toasts; assert ровно 3 видимы (три самых свежих) и старые закрыты в FIFO порядке

  - [ ]* 8.8 Audit test for Persistent `AppAlert` retention
    - Файл `frontend/src/__tests__/appAlert.migration.audit.test.ts`; статический контрольный список call sites (`Dashboard list-area persistent`, `Step5 info`, `ReportPage load-error`, `AdminTemplateTab load-error`, `AdminTemplateTab not-found`, `AdminReportsTab load-error`, `AdminCreatorsTab load-error`)
    - Через `grep_search` / `read_file` подтвердить, что каждый из этих файлов всё ещё содержит inline `<AppAlert ...>`, а файлы из списка миграции (Login, Step1, Step5 для transient, ExpertManagerModal, ReportPage header) уже не содержат transient вызовов
    - _Requirements: 5.11_

- [x] 9. Final checkpoint - full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional tests that can be skipped for faster MVP, но настоятельно рекомендуются для свойств P1–P17 из `design.md`.
- Каждая задача-имплементация ссылается на конкретные acceptance criteria из `requirements.md`.
- Требование 5 (Sonner) и Требование 4 (Loading Manager) реализуются первыми, потому что Требования 1 и 3 на них опираются (AC 1.9, 3.9, 4.4).
- Persistent `AppAlert` намеренно сохраняется в Dashboard list-area, ReportPage load-error, Step5 info, AdminTemplateTab/ReportsTab/CreatorsTab load errors (AC 5.11). Аудит-тест 8.8 фиксирует этот контракт.
- В рамках этого workflow реализация задач не выполняется — этот документ описывает только план. Для запуска задач используйте кнопку "Start task" рядом с пунктом списка.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1", "2.2", "3.2", "5.1", "6.1", "6.3", "6.4"] },
    { "id": 1, "tasks": ["1.3", "1.4", "2.6", "2.9", "2.10", "5.2", "6.2"] },
    { "id": 2, "tasks": ["1.5", "2.3", "2.7", "2.8", "3.1", "5.3", "6.5", "8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7"] },
    { "id": 3, "tasks": ["2.4", "2.5", "3.3", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9", "6.6", "6.7", "6.8", "6.9", "6.10", "8.8"] }
  ]
}
```
