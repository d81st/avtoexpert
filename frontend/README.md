# AvtoExpert Frontend

React + TypeScript + Vite frontend для AvtoExpert.

## Как frontend работает с API

Frontend использует относительный путь `/api` во всех запросах.

В dev-режиме `Vite` proxy (настроен в `vite.config.ts`) перенаправляет `/api` на `http://localhost:3000`.

Отдельный `frontend/.env` для `VITE_API_BASE_URL` не нужен.

## Структура

```text
src/
  components/
  pages/
  services/
  store/
  types/
  utils/
  App.tsx
  main.tsx
```

## Скрипты

```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

## Локальный запуск отдельно

### 1. Убедиться, что backend уже запущен

Ожидаемый адрес backend:

```txt
http://localhost:3000
```

### 2. Запустить frontend

```bash
npm run dev
```

Frontend будет доступен на:

```txt
http://localhost:5173
```

Запросы из браузера на `/api` будут автоматически проксироваться через `vite.config.ts`.

## Build

```bash
npm run build
```

Сборка попадает в `frontend/dist`.

## Текущий режим

Сейчас frontend используется в dev-режиме (`vite dev`) и сборке через `vite build`.

