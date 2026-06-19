# Database Workflow

## ⚡ Быстрые команды

### Первый раз (Setup)

```bash
npm run docker:db:up      # Поднять PostgreSQL
npm run db:migrate        # Создать schema
npm run db:seed          # Загрузить тестовые данные
```

### Каждый день (Start)

```bash
npm run docker:db:up      # Готово!
```

### Остановка (End)

```bash
npm run docker:db:down    # Данные сохранены в volume
```

---

## 📋 Все сценарии

| Сценарий      | Команда                                          | Когда            |
| ------------- | ------------------------------------------------ | ---------------- |
| Первый запуск | `up` → `migrate` → `seed`                        | День 1           |
| Обычный день  | `up`                                             | Ежедневно        |
| Добавить поле | `generate` → `migrate`                           | По необходимости |
| Полный сброс  | `down` → `rm volume` → `up` → `migrate` → `seed` | Редко            |

---

## 📚 Подробно по сценариям

### 1️⃣ Первая настройка (ОДИН РАЗ)

```bash
npm run docker:db:up      # Docker volume создаётся
npm run db:migrate        # Schema создаётся
npm run db:seed          # Тестовые данные (taev/secret)
```

Docker volume `avtoexpert_pro_postgres_data` сохранит все данные между перезапусками.

### 2️⃣ Обычный день (КАЖДЫЙ ДЕНЬ)

```bash
npm run docker:db:up      # Всё восстановлено из volume
```

Нет нужды в migrate/seed — данные уже там!

### 3️⃣ Новое поле в БД

```bash
npm run db:generate       # Создать миграцию
npm run db:migrate        # Применить её
```

Старые данные остаются (не делаем seed).

### 4️⃣ Сброс всех данных

```bash
npm run docker:db:down
wsl docker volume rm avtoexpert_pro_postgres_data
npm run docker:db:up
npm run db:migrate
npm run db:seed
```

---

## ❓ FAQ

**Q: Нужен ли seed каждый день?**  
A: Нет, только один раз.

**Q: Данные теряются при перезагрузке ПК?**  
A: Нет, Docker volume в WSL сохраняет всё.

**Q: Как подключиться к БД вручную?**  
A: `wsl docker exec -it avtoexpert-pro-postgres psql -U postgres -d avtoexpert`

**Q: Забыл пароль от taev?**  
A: Сделай полный сброс (сценарий 4).

---

## 📝 Все npm команды

```bash
npm run db:generate        # Генерировать миграцию
npm run db:migrate         # Применить миграции
npm run db:studio          # Drizzle Studio (UI)
npm run db:seed            # Загрузить тестовые данные
npm run docker:db:up       # Поднять контейнер
npm run docker:db:down     # Остановить контейнер
```

---

**Главное:** Docker volume сохраняет данные автоматически. Используй `npm run docker:db:up` каждый день! ✅
