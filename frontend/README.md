# AvtoExpert Frontend

React + TypeScript + Vite frontend для AvtoExpert.

## Архитектура

- `features/*` содержит бизнес-модули приложения: `auth`, `admin`, `reports`.
- `features/<module>/api` хранит модульный доступ к backend API.
- `features/<module>/types` хранит модульные типы для конкретной feature.
- `features/<module>/ui` хранит экранные модули и привязанный к ним UI.
- `features/reports/hooks` хранит report-specific hooks, используемые только в рамках feature.
- `features/reports/model` хранит report-specific zustand store.
- `features/reports/lib` хранит report-specific helpers, validators и mappers.
- `shared/*` содержит общие примитивы: `api`, `auth`, `ui`, `lib`, `types`.
- `shared/auth` хранит общий auth store и типы, используемые и в `app`, и в `features/*`.
- `app/*` содержит app-level слои, которые не являются UI-примитивами, например routing и error boundary.
- `pages/*` больше не содержит полноценные экраны, а выступает как route-shell с простыми реэкспортами из `features/*`.

## Как frontend работает с API

Frontend использует относительный путь `/api` во всех запросах.

В dev-режиме `Vite` proxy, настроенный в `vite.config.ts`, перенаправляет `/api` на `http://localhost:3000`.

Отдельный `frontend/.env` для `VITE_API_BASE_URL` не нужен.

## Структура

```text
src/
  app/
    errors/                # ErrorBoundary и app-level error handling
    routing/               # PrivateRoute и app-level routing guards
  features/
    auth/
      api/
      types/
      ui/
    admin/
      api/
      types/
      ui/
    reports/
      api/
      hooks/
      lib/
      model/
      types/
      ui/
  shared/
    api/                   # base API client
    auth/                  # shared auth store
    lib/
    types/                 # shared cross-feature types
    ui/                    # reusable UI primitives
  pages/                  # route-shell реэкспорты
  App.tsx
  main.tsx
```

## Скрипты

```bash
npm install
npm run dev
npm run build
npx tsc --noEmit
npm run lint
npm run preview
```

## Локальный запуск

### Предварительные условия

Backend должен быть уже запущен на `http://localhost:3000`.

Инструкции по запуску backend:

- [Docker Desktop (Windows)](../README.md#вариант-a-docker-desktop-на-windows)
- [Docker в WSL](../README.md#вариант-b-docker-установлен-внутри-wsl)

### Запуск frontend

```bash
# 1. Установить зависимости (если ещё не установлены)
npm install

# 2. Запустить dev-сервер
npm run dev
```

Frontend будет доступен на:

```
http://localhost:5173
```

Запросы на `/api` автоматически проксируются через `vite.config.ts` на `http://localhost:3000`.

### Проверка connectivity

Откройте браузер и перейдите на `http://localhost:5173`. Если backend работает корректно, страница должна загрузиться без ошибок подключения.

## Build

```bash
npm run build
```

Сборка попадает в `frontend/dist`.

## Проверка после изменений

Для быстрой типовой проверки:

```bash
npx tsc --noEmit
```
