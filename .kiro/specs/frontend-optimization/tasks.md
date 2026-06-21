# Implementation Plan: Frontend Optimization

## Overview

Исправление 5 проблем фронтенда AvtoExpert Pro: производительность форм, CSS-переменные shadcn/ui, состояние загрузки навигации, валидация repair_works, совместимость с Zod v4. Реализация на TypeScript с использованием существующего стека (React 19, Vite 8, Tailwind CSS v4, Zod v4, React Hook Form 7.79, Zustand 5, fast-check 4.8, vitest 4.1.9).

## Tasks

- [x] 1. Исправить совместимость Zod-схем с Zod v4
  - [x] 1.1 Обновить step2.schema.ts: заменить `{ required_error: "..." }` на `{ error: "..." }` во всех вызовах `z.number()` и `z.enum()`
    - Файл: `src/schemas/step2.schema.ts`
    - Заменить `z.number({ required_error: "..." })` → `z.number({ error: "..." })`
    - Заменить `z.enum([...], { required_error: "..." })` → `z.enum([...], { error: "..." })`
    - _Requirements: 5.1, 5.4_
  - [x] 1.2 Обновить step3.schema.ts: заменить `{ required_error: "..." }` на `{ error: "..." }` во всех вызовах `z.number()` и `z.enum()`
    - Файл: `src/schemas/step3.schema.ts`
    - Аналогичные замены как в 1.1
    - _Requirements: 5.2, 5.4_
  - [x] 1.3 Обновить step4.schema.ts: заменить `{ required_error: "..." }` на `{ error: "..." }` в вызове `z.number()` для hourly_rate
    - Файл: `src/schemas/step4.schema.ts`
    - _Requirements: 5.3_

- [x] 2. Добавить валидацию минимума ремонтных работ в step4Schema
  - [x] 2.1 Добавить `.min(1, "Добавьте минимум одну ремонтную работу")` к массиву `repair_works` в step4Schema
    - Файл: `src/schemas/step4.schema.ts`
    - Изменить `repair_works: z.array(repairWorkSchema)` → `repair_works: z.array(repairWorkSchema).min(1, "Добавьте минимум одну ремонтную работу")`
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ]* 2.2 Написать property-тест для валидации step4Schema
    - **Property 2: repair_works minimum validation**
    - Использовать fast-check для генерации случайных Step4FormData
    - Проверить: schema valid ↔ repair_works.length ≥ 1 AND hourly_rate > 0
    - Минимум 100 итераций
    - **Validates: Requirements 4.1, 4.2, 4.4**

- [x] 3. Checkpoint — Убедиться что TypeScript компиляция проходит без ошибок
  - Ensure all tests pass, ask the user if questions arise.
  - Запустить `tsc --noEmit` и `vitest --run` для проверки

- [x] 4. Добавить CSS-переменные shadcn/ui в index.css
  - [x] 4.1 Добавить блок CSS-переменных для shadcn/ui theme tokens в `:root` секцию файла `src/index.css`
    - Добавить переменные: `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--input`, `--ring`, `--radius`
    - Значения в формате HSL без `hsl()` wrapper (стандарт shadcn/ui)
    - Цвета должны соответствовать текущей светлой теме проекта
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 5. Создать хук useDebouncedStoreSync и применить его в Step4 и Step5
  - [x] 5.1 Создать хук `useDebouncedStoreSync` в `src/features/reports/hooks/useDebouncedStoreSync.ts`
    - Принимает `control` (из react-hook-form), `setter` (функция Zustand store), `delay` (default 300ms)
    - Внутри использует `useWatch({ control })` + `useRef` для таймера + `useEffect` с debounce логикой
    - Очищает таймер при unmount
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ]* 5.2 Написать property-тест для debounce логики
    - **Property 1: Debounce batches rapid changes into a single store update**
    - Извлечь debounce-утилиту в отдельную testable функцию
    - Использовать fast-check + vi.useFakeTimers() для генерации случайных последовательностей вызовов
    - Проверить: setter вызывается ровно 1 раз с последним значением после delay
    - Минимум 100 итераций
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
  - [x] 5.3 Рефакторинг Step4.tsx: заменить `useWatch` + `useEffect` на `useDebouncedStoreSync`
    - Удалить `const watchedValues = useWatch({ control })` и связанный useEffect
    - Добавить `useDebouncedStoreSync(control, setStep4, 300)`
    - Оставить отдельный `useWatch` для `hourlyRate` и `totals` (они нужны для UI), но использовать более гранулярные вызовы: `useWatch({ control, name: 'hourly_rate' })` и `useWatch({ control, name: ['repair_works', 'paint_works', 'spare_parts', 'materials'] })`
    - _Requirements: 1.1, 1.3_
  - [x] 5.4 Рефакторинг Step5.tsx: заменить `useWatch` + `useEffect` на `useDebouncedStoreSync`
    - Удалить `const watchedValues = useWatch({ control })` и связанный useEffect
    - Добавить `useDebouncedStoreSync(control, setStep5, 300)`
    - _Requirements: 1.2_

- [x] 6. Добавить состояние загрузки в кнопку "Далее"
  - [x] 6.1 Расширить `useWizardStepSave` — добавить `isSaving` в возвращаемый объект
    - Файл: `src/features/reports/hooks/useWizardStepSave.ts`
    - Вычислить `isSaving` как OR всех `mutation.isPending` состояний
    - Добавить `isSaving` в интерфейс `UseWizardStepSaveReturn`
    - _Requirements: 3.1_
  - [x] 6.2 Обновить WizardNavigation — принять `isSaving` prop, отключить кнопку и показать спиннер
    - Файл: `src/features/reports/ui/WizardNavigation.tsx`
    - Добавить `isSaving?: boolean` в `WizardNavigationProps`
    - Условие disabled: `disabled={!canGoNext || isSaving}`
    - При `isSaving=true`: показать иконку Loader2 (из lucide-react) + текст "Сохранение..."
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 6.3 Передать `isSaving` из ReportPage в WizardNavigation
    - Файл: `src/features/reports/ui/ReportPage.tsx`
    - Деструктурировать `isSaving` из `useWizardStepSave()`
    - Передать `isSaving={isSaving}` в компонент `<WizardNavigation />`
    - _Requirements: 3.1_
  - [ ]* 6.4 Написать unit-тесты для WizardNavigation
    - Тест: при `isSaving=true` кнопка "Далее" disabled и содержит текст "Сохранение..."
    - Тест: при `isSaving=false` кнопка enabled и содержит текст "Далее →"
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 7. Final checkpoint — Убедиться что все работает
  - Ensure all tests pass, ask the user if questions arise.
  - Запустить `tsc --noEmit`, `vitest --run`, `vite build`

## Task Dependency Graph

```
3. Checkpoint — Убедиться что TypeScript компиляция проходит без ошибок -> 7. Final checkpoint — Убедиться что все работает
4.1 Добавить блок CSS-переменных для shadcn/ui theme tokens в :root секцию файла src/index.css -> 7. Final checkpoint — Убедиться что все работает
5.1 Создать хук useDebouncedStoreSync в src/features/reports/hooks/useDebouncedStoreSync.ts -> 5.3 Рефакторинг Step4.tsx: заменить useWatch + useEffect на useDebouncedStoreSync
5.1 Создать хук useDebouncedStoreSync в src/features/reports/hooks/useDebouncedStoreSync.ts -> 5.4 Рефакторинг Step5.tsx: заменить useWatch + useEffect на useDebouncedStoreSync
5.3 Рефакторинг Step4.tsx: заменить useWatch + useEffect на useDebouncedStoreSync -> 7. Final checkpoint — Убедиться что все работает
5.4 Рефакторинг Step5.tsx: заменить useWatch + useEffect на useDebouncedStoreSync -> 7. Final checkpoint — Убедиться что все работает
6.1 Расширить useWizardStepSave — добавить isSaving в возвращаемый объект -> 6.2 Обновить WizardNavigation — принять isSaving prop, отключить кнопку и показать спиннер
6.2 Обновить WizardNavigation — принять isSaving prop, отключить кнопку и показать спиннер -> 6.3 Передать isSaving из ReportPage в WizardNavigation
6.3 Передать isSaving из ReportPage в WizardNavigation -> 7. Final checkpoint — Убедиться что все работает
```

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Задачи 1–2 исправляют Zod-схемы (критично для работоспособности)
- Задача 4 — чисто CSS, не требует JS изменений
- Задачи 5–6 — рефакторинг, требуют аккуратного тестирования
- fast-check уже установлен в devDependencies проекта
- Property tests используют vitest + fast-check
