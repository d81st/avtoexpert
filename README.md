# AvtoExpert Pro

Локальная разработка идёт в режиме `backend + frontend`, Docker используется только для PostgreSQL.

## Архитектура

- `frontend` построен вокруг feature-структуры: `app/*` для app-level слоёв, `features/*` для бизнес-модулей, `shared/*` для общих примитивов, `pages/*` только для route-shell.
- `backend` использует модульную структуру `routes -> service -> repository`, где HTTP-роуты остаются thin и не содержат бизнес-оркестрации.
- общего root `package.json` нет, `backend` и `frontend` запускаются отдельно.
- frontend использует относительный путь `/api`, а в dev-режиме `Vite` proxy отправляет запросы на `http://localhost:3000`.

## Структура

```text
avtoexpert-pro/
  backend/
    src/
      common/              # middleware, errors, shared schemas
      db/                  # schema, connection, seed
      modules/
        auth/
        experts/
        reports/
        admin/
      shared/              # storage, logger, infra
    docker-compose.yml     # только PostgreSQL
    package.json
  frontend/
    src/
      app/
        errors/
        routing/
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
      shared/              # api client, auth state, ui, lib, shared types
        auth/
        api/
        lib/
        types/
        ui/
      pages/               # route-shell реэкспорты
    public/
    vite.config.ts
    package.json
```

## Env-файлы

Используется только backend env:

- `backend/.env`
- `backend/.env.example`

Для frontend отдельный `.env` сейчас не нужен.

## Быстрый запуск

### 1. Установить зависимости

В `backend`:

```bash
npm install
```

В `frontend`:

```bash
npm install
```

### 2. Создать `backend/.env`

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/avtoexpert
JWT_SECRET=replace-with-at-least-32-characters-secret
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:5173
```

### 3. Поднять PostgreSQL

Если база запускается через Docker, перейдите в `backend` и выполните:

```bash
npm run docker:db:up
```

Если PostgreSQL установлен локально без Docker, достаточно рабочего `DATABASE_URL`.

### 4. Применить миграции и seed

В `backend`:

```bash
npm run db:migrate
npm run db:seed
```

Тестовый доступ после seed:

- логин: `taev`
- пароль: `secret`

### 5. Запустить backend и frontend

В терминале `backend`:

```bash
npm run dev
```

В терминале `frontend`:

```bash
npm run dev
```

Адреса:

- frontend: `http://localhost:5173`
- backend: `http://localhost:3000`
- API из frontend: `/api`
