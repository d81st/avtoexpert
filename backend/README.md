# AvtoExpert Backend

Express + TypeScript backend с modular-структурой, Drizzle ORM и PostgreSQL.

## Структура

```text
src/
  app.ts                 # composition root Express-приложения
  server.ts              # запуск HTTP-сервера
  config/                # env/config
  db/                    # Drizzle schema, connection, seed
  common/                # общие middleware, errors, schemas
  shared/                # shared infrastructure
  modules/
    auth/
    experts/
    reports/
    admin/
```

## Что делает backend

- авторизация и получение текущего пользователя
- CRUD для экспертов
- CRUD для заключений
- загрузка и удаление фотографий
- генерация и скачивание документов
- административные маршруты

Основные маршруты:

- `POST /api/login`
- `GET /api/me`
- `GET/POST/PATCH/DELETE /api/experts`
- `GET/POST/PATCH/DELETE /api/reports`
- `POST /api/reports/:id/finalize-and-generate`
- `GET /api/reports/:id/download`
- `GET/POST/DELETE /api/reports/:id/photos`
- `GET /api/admin/*`

## Env

Локально backend использует файл `backend/.env`.

Минимальный пример:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/avtoexpert
JWT_SECRET=replace-with-at-least-32-characters-secret
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:5173
```

Шаблон: `backend/.env.example`

## Скрипты

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
npm run format
npm run docker:db:up
npm run docker:db:down
npm run db:generate
npm run db:migrate
npm run db:studio
npm run db:seed
```

## Локальный запуск отдельно

### 1. Поднять PostgreSQL

Из `backend` можно использовать:

```bash
npm run docker:db:up
```

Либо поднять PostgreSQL любым другим способом и указать правильный `DATABASE_URL`.

### 2. Применить миграции и seed

```bash
npm run db:migrate
npm run db:seed
```

Тестовый доступ после seed:

- логин: `taev`
- пароль: `secret`

### 3. Запустить backend

```bash
npm run dev
```

Backend будет доступен на `http://localhost:3000`.

Health endpoint:

```txt
GET /health
```

## Docker

В текущем dev-режиме Docker используется только для PostgreSQL.

Файл `backend/docker-compose.yml` поднимает только сервис базы данных.
