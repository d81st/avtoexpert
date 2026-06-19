# 📚 Документация AvtoExpert Pro

Компактная и организованная документация проекта.

## 🚀 Быстрый старт

### Первый день
```bash
npm run docker:db:up      # Поднять БД
npm run db:migrate        # Создать schema
npm run db:seed          # Загрузить данные (taev/secret)
```

### Каждый день
```bash
npm run docker:db:up      # Всё готово!
```

---

## 📖 Документы

### 1. **[DB_WORKFLOW.md](./DB_WORKFLOW.md)** — БД и команды
- Быстрые команды для всех сценариев
- Когда нужна migrate/seed
- FAQ
- ⏱️ **5 минут на чтение**

### 2. **[STORAGE.md](./STORAGE.md)** — Архитектура хранения
- Где что хранится (uploads, templates, БД)
- Почему локальное FS для uploads
- Docker volume информация
- ⏱️ **3 минуты на чтение**

### 3. **[avtoexpert-tz-v3.md](./avtoexpert-tz-v3.md)** — Техническое задание
- Требования проекта
- Описание функций
- ⏱️ **По необходимости**

### 4. **[../README.md](../README.md)** — Главный файл
- Архитектура проекта
- Инструкции по запуску
- Ссылки на backend/frontend README
- ⏱️ **10 минут на чтение**

---

## 🔗 Связанная документация

**Backend:** [`backend/README.md`](../backend/README.md)
- Архитектура backend
- Основные маршруты
- Инструкции по запуску

**Frontend:** [`frontend/README.md`](../frontend/README.md)
- Архитектура frontend
- API proxy конфигурация
- Инструкции по запуску

---

## ❓ Нужна помощь?

| Вопрос | Документ |
|--------|----------|
| Как запустить БД? | [DB_WORKFLOW.md](./DB_WORKFLOW.md) |
| Где хранятся файлы? | [STORAGE.md](./STORAGE.md) |
| Какие требования? | [avtoexpert-tz-v3.md](./avtoexpert-tz-v3.md) |
| Как работает проект? | [../README.md](../README.md) |
| Как запустить backend? | [../backend/README.md](../backend/README.md) |
| Как запустить frontend? | [../frontend/README.md](../frontend/README.md) |

---

## 📋 Структура docs/

```
docs/
├── INDEX.md (этот файл)
├── DB_WORKFLOW.md (компактный гайд БД)
├── STORAGE.md (архитектура хранения)
└── avtoexpert-tz-v3.md (требования ТЗ)
```

---

**Последнее обновление:** 2026-06-19
