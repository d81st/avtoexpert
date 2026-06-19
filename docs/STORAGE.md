# Storage Architecture

## 🗂️ Где что хранится

| Тип данных | Место | Способ | Зачем |
|-----------|-------|--------|-------|
| **📸 Фотографии** | `backend/uploads/photos/` | Локальный FS | Dev-режим (просто) |
| **📝 Шаблоны DOCX** | `backend/templates/` | Локальный FS | docxtemplater |
| **🗄️ PostgreSQL** | Docker | Docker volume | Персистенция |

---

## 🐳 Docker Volume

**Имя:** `avtoexpert_pro_postgres_data`

**Конфигурация:**
```yaml
# backend/docker-compose.yml
services:
  postgres:
    volumes:
      - avtoexpert_pro_postgres_data:/var/lib/postgresql/data
```

**Что хранит:** Все таблицы, схему и данные PostgreSQL

**Персистенция:** ✅ Сохраняется между перезапусками контейнера

---

## 💾 Локальное хранилище (Uploads & Templates)

**Путь конфигурации:**
```typescript
// backend/src/config/env.ts
const uploadDir = parsed.UPLOAD_DIR ?? path.resolve(process.cwd(), 'uploads');
const templateDir = parsed.TEMPLATE_DIR ?? path.resolve(process.cwd(), 'templates');
```

**Использование:**
```bash
backend/
├── uploads/
│   └── photos/         # Фотографии пользователей
└── templates/          # DOCX шаблоны
```

**Почему локально?**
- ✨ Просто для dev-режима
- ✨ Файлы видны в IDE
- ✨ Нет Docker overhead
- ✨ Production будет использовать S3/Cloud

---

## 🔄 Миграция Dev → Production

| Компонент | Development | Production |
|-----------|------------|-----------|
| **Uploads** | Локально | S3 / Cloud Storage |
| **Templates** | Локально | S3 / Cloud Storage |
| **Database** | Docker volume | Managed DB (RDS, Cloud SQL) |

---

## 🚀 Команды для работы с storage

```bash
# Удалить локальные uploads
rm -rf backend/uploads

# Удалить Docker volume (⚠️ БЕЗ ВОЗВРАТА)
wsl docker volume rm avtoexpert_pro_postgres_data

# Проверить volumes
wsl docker volume ls
```

---

**Итог:** 
- **Uploads** хранятся локально (по замыслу архитектуры)
- **БД** в Docker volume (по замыслу архитектуры)  
- **Production** будет другой (S3 + Managed DB)
