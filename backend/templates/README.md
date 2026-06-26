# Шаблоны документов

В этой папке находятся шаблоны .docx-документов, используемые `Doc_Generator`
(`backend/src/modules/reports/docGenerator.ts`) для генерации заключений.

## Активный шаблон (Docx_Template_V3)

**Файл:** `original_example.docx`

Это единственный production-шаблон, который читает `Doc_Generator`. Соответствует
требованию `R3.1` спека `platform-improvements-mvp`: `Doc_Generator` SHALL
использовать `backend/templates/original_example.docx` в качестве единственного
исходного шаблона.

`Docx_Template_V3` (спек `docx-photo-slots`, требования R1.1–R1.6) — это
текущая ревизия активного шаблона. Файл содержит ровно 6 фиксированных
inline-плейсхолдеров `{%photo_1}…{%photo_6}` и 6 скалярных подписей
`{caption_1}…{caption_6}` рядом с каждым слотом. Других docxtemplater-маркеров
для фото в шаблоне нет.

## Архив (Docx_Template_V1)

**Файл:** `archive/expertise.docx`

Прежний шаблон `expertise.docx` перемещён в подпапку `archive/` в соответствии с
требованием `R3.3` (`THE Docx_Template_V1 SHALL быть перемещён в каталог
backend/templates/archive/ с сохранением имени файла expertise.docx`) и
зафиксированным в `design.md` финальным путём `backend/templates/archive/expertise.docx`.

`Doc_Generator` и любой другой production-код в `backend/src/**` SHALL NOT
ссылаться на `expertise.docx` (`R3.2`). Архивная копия сохраняется только для
исторической справки и для смок-тестов, проверяющих её наличие и одновременное
отсутствие ссылок на неё в `src/`.

## Авторитетная инвентаризация плейсхолдеров (R3.1, R3.2 спека `docx-photo-slots`)

> Источник истины: фактическое содержимое ZIP-частей `word/document.xml` и
> `word/footer1.xml` файла `original_example.docx`, снятое скриптом
> `backend/scripts/inventory-placeholders.cjs`. Для повторной проверки запустите
> `node scripts/inventory-placeholders.cjs` (вывод в `scripts/inventory-out.json`).
>
> Активный шаблон `Docx_Template_V3` содержит ровно 12 маркеров `docxtemplater`:
> 6 raw image-тегов `{%photo_N}` (N ∈ {1..6}) и 6 скалярных тегов `{caption_N}`
> (N ∈ {1..6}). Каждый токен встречается ровно один раз. Прочие фигурные
> скобки в XML (`{909E8E84-…}`, `{91240B29-…}` в `word/document.xml` и
> `word/footer1.xml`) — это GUID-атрибуты графических объектов Office
> (`a14:hiddenFill` / `a14:hiddenLine`), а **не** маркеры `docxtemplater`;
> шаблонизатором они не обрабатываются.

### Photo_Slot_Placeholder (raw image-теги)

| Токен | Тип | Вхождений | Где |
|---|---|---|---|
| `{%photo_1}` | raw image | 1 | `word/document.xml` |
| `{%photo_2}` | raw image | 1 | `word/document.xml` |
| `{%photo_3}` | raw image | 1 | `word/document.xml` |
| `{%photo_4}` | raw image | 1 | `word/document.xml` |
| `{%photo_5}` | raw image | 1 | `word/document.xml` |
| `{%photo_6}` | raw image | 1 | `word/document.xml` |

### Photo_Caption_Placeholder (скалярные теги)

| Токен | Тип | Вхождений | Где |
|---|---|---|---|
| `{caption_1}` | scalar | 1 | `word/document.xml` |
| `{caption_2}` | scalar | 1 | `word/document.xml` |
| `{caption_3}` | scalar | 1 | `word/document.xml` |
| `{caption_4}` | scalar | 1 | `word/document.xml` |
| `{caption_5}` | scalar | 1 | `word/document.xml` |
| `{caption_6}` | scalar | 1 | `word/document.xml` |

Геометрия слотов (EMU-размеры `<wp:extent cx="..." cy="..."/>` каждой из 6
позиций) зафиксирована в коде как readonly-кортеж `SLOT_SIZE_INVENTORY` в
`backend/src/modules/reports/photoSlots.ts`. Источник истины для кода —
именно этот кортеж; `scripts/inventory-out.json` хранит forensic-snapshot
размеров на момент снятия инвентаризации.

### Соответствие `Photo_Slot_Index` ↔ `photos.position`

Слот `{%photo_N}` рендерится изображением из той `photos`-строки, у которой
`position = N` (1-based). Подпись `{caption_N}` рендерится из поля `caption`
той же строки (или пустой строкой при `caption IS NULL` или при отсутствии
строки для данной позиции). Фото с `position > 6` остаются в БД и видны в
UI, но в DOCX не попадают (см. R9.2–R9.4 спека `docx-photo-slots`).

### Расхождение с ожидаемой инвентаризацией design §3.3

Design §3.3 (`platform-improvements-mvp`) перечисляет 29 скалярных
плейсхолдеров (`expert_name`, `report_number`, … `grand_total`) и 4 группы
повторяющихся строк (`repair_works`, `paint_works`, `spare_parts`,
`materials`). **Ни один из этих маркеров в текущем файле
`original_example.docx` физически отсутствует.** Шаблон представляет собой
готовый (предзаполненный реальными данными) экспертный отчёт; в этом
шаблоне маркерами `docxtemplater` размечены только фото-слоты.

Практическое следствие: `DocGenerator.generateDocument()`
(`docGenerator.ts`) передаёт в `doc.render({...})` все 29 скалярных полей и 4
коллекции, но `docxtemplater` **молча игнорирует** данные, для которых в
шаблоне нет соответствующего маркера. Поэтому скалярные/табличные значения
отчёта в итоговый `.docx` сейчас не попадают — заполняются только
фото-слоты. Приведение шаблона в полное соответствие design §3.3 — задача
вне scope спека `docx-photo-slots` и обсуждается отдельно.

<details>
<summary>Ожидаемый по design §3.3 набор плейсхолдеров (референс, в шаблоне пока отсутствует)</summary>

Скалярные: `expert_name`, `report_number`, `report_date`, `application_date`,
`car_model`, `car_year`, `car_color`, `body_type`, `license_plate`,
`owner_name`, `tech_passport`, `tech_passport_place`, `mileage`,
`odometer_status`, `vin_code`, `engine_number`, `transmission_type`,
`production_status`, `analog1_mileage`, `analog1_price`, `analog2_mileage`,
`analog2_price`, `analog3_mileage`, `analog3_price`, `factory_price`,
`depreciation_pct`, `market_price`, `hourly_rate`, `grand_total`.

Группы повторяющихся строк:
- `{#repair_works}…{/repair_works}` → `{part_name}`, `{part_type}`, `{complexity}`, `{price}`
- `{#paint_works}…{/paint_works}` → `{part_name}`, `{paint_price}`, `{polish_price}`
- `{#spare_parts}…{/spare_parts}` → `{name}`, `{qty}`, `{price}`
- `{#materials}…{/materials}` → `{name}`, `{qty}`, `{price}`

</details>

## Инструкция по созданию шаблона

1. Создайте документ Microsoft Word (.docx)
2. Добавьте плейсхолдеры в фигурных скобках `{placeholder_name}`
3. Для inline-изображений используйте raw-синтаксис `docxtemplater-image-module-free`:
   `{%placeholder_name}` (источник — поле scope с абсолютным путём к файлу).
4. Сохраните файл как `original_example.docx` в этой папке.

## Пример (slot-based рендер фото)

Чтобы вставить пользовательское фото №1 с подписью в шаблон, разместите
рядом два плейсхолдера:

```
{%photo_1}
{caption_1}
```

`DocGenerator.generateDocument` подставит абсолютный путь к нормализованному
файлу фото в `{%photo_1}` (изображение будет вписано в EMU-размеры слота из
`SLOT_SIZE_INVENTORY[0]`) и значение поля `photos.caption` соответствующей
строки в `{caption_1}`. Для остальных пяти позиций повторите шаблон с N от 2
до 6.
