# Design Document: Исправление Select dropdown и генерации документов

## Overview

Два независимых исправления:

1. **Frontend (CSS)**: Добавить блок `@theme` в `index.css`, чтобы Tailwind CSS v4 корректно резолвил CSS-переменные shadcn/ui в цветовые утилиты (`bg-popover`, `bg-background` и т.д.). Это устранит прозрачный фон у SelectContent и всех остальных shadcn-компонентов.

2. **Backend (DocGenerator)**: Добавить маппинг полей коллекций (repairWorks, paintWorks, spareParts, materials) из camelCase (формат Drizzle ORM) в snake_case (формат плейсхолдеров шаблона) перед передачей в docxtemplater. Улучшить обработку ошибок.

## Architecture

### Bug 1: CSS Theme Tokens

```
┌────────────────────────────┐
│   index.css                │
│                            │
│  @import "tailwindcss"     │
│                            │
│  @theme {                  │  ← ДОБАВИТЬ: маппинг CSS vars → Tailwind tokens
│    --color-background: ... │
│    --color-popover: ...    │
│  }                         │
│                            │
│  :root {                   │  ← СУЩЕСТВУЕТ: определение значений переменных
│    --background: ...       │
│    --popover: ...          │
│  }                         │
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│  Tailwind v4 Engine        │
│  bg-popover → background-  │
│  color: var(--color-       │
│  popover)                  │
└────────────────────────────┘
```

В Tailwind CSS v4 пользовательские цвета регистрируются через `@theme` директиву. Без неё утилиты типа `bg-popover` не генерируются. Переменные в формате `0 0% 100%` (голые HSL значения) нужно обернуть в `hsl()`.

### Bug 2: DocGenerator Field Mapping

```
┌──────────────────┐     ┌───────────────────┐     ┌─────────────────┐
│  Database (DB)   │────▶│  reports.service   │────▶│  DocGenerator   │
│                  │     │                    │     │                 │
│  repairWorks:    │     │  passes arrays     │     │  mapCollections │ ← ДОБАВИТЬ
│   .partName      │     │  as-is to          │     │  camelCase →    │
│   .partType      │     │  docGenerator      │     │  snake_case     │
│   .complexity    │     │                    │     │                 │
│   .price         │     │                    │     │  doc.render()   │
└──────────────────┘     └───────────────────┘     └─────────────────┘
                                                           │
                                                           ▼
                                                   ┌─────────────────┐
                                                   │  Template       │
                                                   │  {#repair_works}│
                                                   │  {part_name}    │
                                                   │  {part_type}    │
                                                   │  {/repair_works}│
                                                   └─────────────────┘
```

## Components and Interfaces

### Bug 1: Изменяемые файлы

**`frontend/src/index.css`**:
- Добавить блок `@theme` после `@import "tailwindcss"` с маппингом всех shadcn/ui цветовых токенов
- Преобразовать CSS-переменные из формата `0 0% 100%` в `hsl(0 0% 100%)`

**`frontend/tailwind.config.js`**:
- Файл не требует изменений (в Tailwind v4 конфигурация через CSS)

### Bug 2: Изменяемые файлы

**`backend/src/modules/reports/docGenerator.ts`**:
- Добавить маппинг-функции для каждого типа коллекции
- Применить маппинг перед `doc.render()`
- Улучшить catch-блок для проброса оригинальной ошибки

#### Интерфейс маппинг-функций:

```typescript
// Типы данных из БД (Drizzle ORM format)
interface DbRepairWork {
  id: string;
  reportId: string;
  partName: string | null;
  partType: string | null;
  complexity: string | null;
  price: number | null;
}

interface DbPaintWork {
  id: string;
  reportId: string;
  partName: string | null;
  paintPrice: number | null;
  polishPrice: number | null;
}

interface DbSparePart {
  id: string;
  reportId: string;
  name: string | null;
  qty: number | null;
  price: number | null;
}

interface DbMaterial {
  id: string;
  reportId: string;
  name: string | null;
  qty: number | null;
  price: number | null;
}

// Типы для шаблона (template format)
interface TemplateRepairWork {
  part_name: string;
  part_type: string;
  complexity: string;
  price: number;
}

interface TemplatePaintWork {
  part_name: string;
  paint_price: number;
  polish_price: number;
}

interface TemplateSparePart {
  name: string;
  qty: number;
  price: number;
}

interface TemplateMaterial {
  name: string;
  qty: number;
  price: number;
}

// Маппинг-функции
function mapRepairWorks(items: DbRepairWork[]): TemplateRepairWork[];
function mapPaintWorks(items: DbPaintWork[]): TemplatePaintWork[];
function mapSpareParts(items: DbSparePart[]): TemplateSparePart[];
function mapMaterials(items: DbMaterial[]): TemplateMaterial[];
```

## Data Models

### Маппинг полей: DB → Template

| Коллекция    | DB поле (camelCase) | Template поле (snake_case) |
|-------------|--------------------|-----------------------------|
| repairWorks | `partName`         | `part_name`                 |
| repairWorks | `partType`         | `part_type`                 |
| repairWorks | `complexity`       | `complexity`                |
| repairWorks | `price`            | `price`                     |
| paintWorks  | `partName`         | `part_name`                 |
| paintWorks  | `paintPrice`       | `paint_price`               |
| paintWorks  | `polishPrice`      | `polish_price`              |
| spareParts  | `name`             | `name`                      |
| spareParts  | `qty`              | `qty`                       |
| spareParts  | `price`            | `price`                     |
| materials   | `name`             | `name`                      |
| materials   | `qty`              | `qty`                       |
| materials   | `price`            | `price`                     |

### CSS Theme Token Mapping

| shadcn token (CSS var) | @theme variable          | Значение                    |
|------------------------|--------------------------|-----------------------------|
| `--background`         | `--color-background`     | `hsl(0 0% 100%)`           |
| `--foreground`         | `--color-foreground`     | `hsl(222.2 84% 4.9%)`     |
| `--popover`            | `--color-popover`        | `hsl(0 0% 100%)`           |
| `--popover-foreground` | `--color-popover-foreground` | `hsl(222.2 84% 4.9%)`  |
| `--card`               | `--color-card`           | `hsl(0 0% 100%)`           |
| `--primary`            | `--color-primary`        | `hsl(221.2 83.2% 53.3%)`  |
| `--secondary`          | `--color-secondary`      | `hsl(210 40% 96.1%)`      |
| `--muted`              | `--color-muted`          | `hsl(210 40% 96.1%)`      |
| `--accent`             | `--color-accent`         | `hsl(210 40% 96.1%)`      |
| `--destructive`        | `--color-destructive`    | `hsl(0 84.2% 60.2%)`      |
| `--border`             | `--color-border`         | `hsl(214.3 31.8% 91.4%)`  |
| `--input`              | `--color-input`          | `hsl(214.3 31.8% 91.4%)`  |
| `--ring`               | `--color-ring`           | `hsl(221.2 83.2% 53.3%)`  |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: RepairWorks field mapping preserves values

*For any* array of repairWorks objects from the database with arbitrary `partName`, `partType`, `complexity`, and `price` values, applying `mapRepairWorks` SHALL produce objects with keys exactly `{part_name, part_type, complexity, price}` where each value equals the corresponding source field (with null coalesced to default).

**Validates: Requirements 2.1**

### Property 2: PaintWorks field mapping preserves values

*For any* array of paintWorks objects from the database with arbitrary `partName`, `paintPrice`, and `polishPrice` values, applying `mapPaintWorks` SHALL produce objects with keys exactly `{part_name, paint_price, polish_price}` where each value equals the corresponding source field (with null coalesced to default).

**Validates: Requirements 2.2**

### Property 3: SpareParts and Materials field mapping preserves values

*For any* array of spareParts or materials objects from the database with arbitrary `name`, `qty`, and `price` values, applying `mapSpareParts` or `mapMaterials` SHALL produce objects with keys exactly `{name, qty, price}` where each value equals the corresponding source field (with null coalesced to default).

**Validates: Requirements 2.3, 2.4**

## Error Handling

### DocGenerator

**Текущее поведение (баг)**:
```typescript
catch (error) {
  logger.error('Document generation error', error);
  throw new Error('Document generation error');
  // Оригинальная ошибка теряется
}
```

**Исправленное поведение**:
```typescript
catch (error) {
  const originalMessage = error instanceof Error ? error.message : String(error);
  logger.error('Document generation error', { error, originalMessage });
  throw new Error(`Document generation error: ${originalMessage}`, { cause: error });
}
```

Это позволит:
- Видеть причину ошибки в логах и в ответе API
- Использовать `error.cause` для доступа к оригинальному исключению
- Упростить отладку проблем с шаблоном

### CSS (Frontend)

Ошибки CSS не бросают исключений в runtime — если `@theme` блок имеет синтаксическую ошибку, Tailwind просто не сгенерирует соответствующие утилиты. Верификация — через визуальную проверку и build step.

## Testing Strategy

### Backend (DocGenerator)

**Unit tests (vitest)**:
- Тест маппинга repairWorks с конкретными значениями
- Тест маппинга paintWorks с конкретными значениями
- Тест маппинга spareParts/materials с конкретными значениями
- Тест обработки null-значений в полях
- Тест пробрасывания ошибки с оригинальным сообщением

**Property tests (vitest + fast-check)**:
- Property 1: mapRepairWorks сохраняет значения и использует правильные ключи
- Property 2: mapPaintWorks сохраняет значения и использует правильные ключи
- Property 3: mapSpareParts/mapMaterials сохраняет значения и использует правильные ключи

Библиотека PBT: `fast-check` (стандартная для TypeScript/Vitest)
Минимум 100 итераций на каждый property-тест.

### Frontend (CSS)

- Визуальная проверка: Select dropdown должен иметь белый фон
- Build-тест: `npm run build` должен завершаться без ошибок
- Smoke-тест: утилита `bg-popover` в собранном CSS содержит валидное значение `background-color`

Property-based testing не применим к CSS-исправлению (это конфигурационное изменение, не логика).
