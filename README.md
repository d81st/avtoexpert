# AvtoExpert Pro

Текущий режим проекта: локальная разработка `backend + frontend`, Docker используется только для PostgreSQL.

## Структура

```text
avtoexpert-pro/
  backend/
    src/
    docker-compose.yml     # только PostgreSQL
    package.json
  frontend/
    src/
    public/
    vite.config.ts
    package.json
```

## Как теперь работает проект

- `backend` запускается отдельно из `backend`
- `frontend` запускается отдельно из `frontend`
- общего root `package.json` больше нет
- frontend использует относительный путь `/api`
- в dev режиме `Vite` proxy отправляет `/api` на `http://localhost:3000`

## Env-файлы

Используется только backend env:

- `backend/.env`
- `backend/.env.example`

Для frontend отдельный `.env` не нужен.

## Быстрый запуск

### 1. Установить зависимости отдельно

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

Если база запускается через Docker внутри WSL, перейдите в `backend` и выполните:

```bash
npm run docker:db:up
```

Если PostgreSQL установлен локально без Docker, достаточно чтобы `DATABASE_URL` указывал на рабочую БД.

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
