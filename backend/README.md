# AvtoExpert Backend

Express + TypeScript backend с модульной структурой, Drizzle ORM и PostgreSQL.

## Архитектура

- каждый модуль в `src/modules/*` организован по схеме `routes -> service -> repository`;
- routes остаются thin: парсят запрос, вызывают service и возвращают ответ;
- бизнес-оркестрация сосредоточена в service-слое;
- доступ к БД и SQL-логика сосредоточены в repository-слое;
- Zod-схемы лежат рядом с модулями и используются через middleware `validate()`.

Это особенно важно для модулей:

- `reports`: создание черновика, загрузка шагов, autosave, финализация и генерация документа идут через service;
- `admin`: template upload валидируется отдельной schema, а список отчётов использует общий repository-метод.

## Структура

```text
src/
  app.ts                 # composition root Express-приложения
  server.ts              # запуск HTTP-сервера
  config/                # env/config
  db/                    # Drizzle schema, connection, seed
  common/                # middleware, errors, common schemas
  shared/                # logger, storage и общая инфраструктура
  modules/
    auth/
      *.routes.ts
      *.schemas.ts
      *.service.ts
    experts/
      *.routes.ts
      *.schemas.ts
      *.service.ts
    reports/
      reports.routes.ts
      reports.schemas.ts
      reports.service.ts
      reports.repository.ts
      docGenerator.ts
    admin/
      admin.routes.ts
      admin.schemas.ts
      admin.service.ts
```

## Что делает backend

- авторизация и получение текущего пользователя;
- CRUD для экспертов;
- CRUD для заключений;
- загрузка и удаление фотографий;
- генерация и скачивание документов;
- административные маршруты и работа с шаблоном DOCX.

Основные маршруты:

- `POST /api/login`
- `GET /api/me`
- `GET/POST/PATCH/DELETE /api/experts`
- `GET/POST/PATCH/DELETE /api/reports`
- `POST /api/reports/:id/finalize-and-generate`
- `GET /api/reports/:id/download`
- `GET/POST/DELETE /api/reports/:id/photos`
- `GET /api/admin/*`
- `POST /api/admin/template`

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
npx tsc --noEmit
npm run docker:db:up
npm run docker:db:down
npm run db:generate
npm run db:migrate
npm run db:studio
npm run db:seed
```

## Локальный запуск

### 1. Поднять PostgreSQL

Из `backend` можно использовать:

```bash
npm run docker:db:up
```

Либо поднять PostgreSQL любым другим способом и указать корректный `DATABASE_URL`.

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
