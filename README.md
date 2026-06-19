# AvtoExpert Pro

Локальная разработка идёт в режиме `backend + frontend`, Docker используется только для PostgreSQL.

## Архитектура

- `frontend` построен вокруг feature-структуры: `app/*` для app-level слоёв, `features/*` для бизнес-модулей, `shared/*` для общих примитивов, `pages/*` только для route-shell.
- `backend` использует модульную структуру `routes -> service -> repository`, где HTTP-роуты остаются thin и не содержат бизнес-оркестрации.
- общего root `package.json` нет, `backend` и `frontend` запускаются отдельно.
- frontend использует относительный путь `/api`, а в dev-режиме `Vite` proxy отправляет запросы на `http://localhost:3000`.
- **Хранение файлов:**
  - `uploads/photos/` — фотографии пользователей хранятся **локально** на диске (не в Docker volume)
  - `templates/` — DOCX шаблоны хранятся **локально** на диске
  - PostgreSQL данные хранятся в Docker volume `avtoexpert_pro_postgres_data`

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

## 📚 Документация

Вся документация находится в папке [`docs/`](./docs/):

- **[docs/INDEX.md](./docs/INDEX.md)** — Индекс всей документации
- **[docs/DB_WORKFLOW.md](./docs/DB_WORKFLOW.md)** — Гайд по работе с БД
- **[docs/DOCKER_CLEANUP.md](./docs/DOCKER_CLEANUP.md)** — Анализ Docker архитектуры
- **[docs/STORAGE_ARCHITECTURE.md](./docs/STORAGE_ARCHITECTURE.md)** — Архитектура хранения файлов

## Быстрый запуск

### Шаг 0: Выбор способа установки

Выберите подходящий вариант в зависимости от вашей конфигурации:

- **Вариант A**: Docker Desktop на Windows (рекомендуется)
- **Вариант B**: Docker установлен внутри WSL (Windows Subsystem for Linux)

---

## Вариант A: Docker Desktop на Windows

> Рекомендуется для Windows. Docker Desktop автоматически настраивает сеть и порты.

### A.1. Установить зависимости

В `backend`:

```bash
npm install
```

В `frontend`:

```bash
npm install
```

### A.2. Создать `backend/.env`

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/avtoexpert
JWT_SECRET=replace-with-at-least-32-characters-secret
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:5173
```

### A.3. Поднять PostgreSQL через Docker Desktop

Из директории `backend`:

```bash
docker compose up -d postgres
```

Проверить, что контейнер работает:

```bash
docker ps
```

Должен быть запущен контейнер `avtoexpert-pro-postgres` с портом `5432`.

### A.4. Применить миграции и seed

В `backend`:

```bash
npm run db:migrate
npm run db:seed
```

Тестовый доступ после seed:

- логин: `taev`
- пароль: `secret`

### A.5. Запустить backend и frontend

В отдельных терминалах:

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Адреса:

- frontend: `http://localhost:5173`
- backend: `http://localhost:3000`
- API из frontend: `/api` (проксируется на backend через Vite)

---

## Вариант B: Docker установлен внутри WSL

> Используется если Docker установлен внутри WSL, а не Docker Desktop.

### B.1. Установить зависимости

В `backend`:

```bash
npm install
```

В `frontend`:

```bash
npm install
```

### B.2. Создать `backend/.env`

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/avtoexpert
JWT_SECRET=replace-with-at-least-32-characters-secret
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:5173
```

### B.3. Поднять PostgreSQL через Docker в WSL

Из директории `backend` на Windows (используйте встроенный скрипт):

```bash
npm run docker:db:up
```

Или вручную в WSL:

```bash
wsl docker compose up -d postgres
```

Проверить статус контейнера:

```bash
wsl docker ps
```

Должен быть запущен контейнер `avtoexpert-pro-postgres` с портом `5432`.

### B.4. Применить миграции и seed

В `backend` (на Windows):

```bash
npm run db:migrate
npm run db:seed
```

Тестовый доступ после seed:

- логин: `taev`
- пароль: `secret`

### B.5. Запустить backend и frontend

В отдельных терминалах на Windows:

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Адреса:

- frontend: `http://localhost:5173`
- backend: `http://localhost:3000`
- API из frontend: `/api` (проксируется на backend через Vite)

---

## Проверка работоспособности

### Health Check

Убедиться, что backend работает:

```bash
curl http://localhost:3000/health
```

Ожидаемый ответ:

```json
{"status":"ok"}
```

### Login Check

Проверить аутентификацию с тестовыми учетными данными:

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"login":"taev","password":"secret"}'
```

### Frontend Check

Открить браузер и перейти на `http://localhost:5173`. Должна загрузиться страница входа.
