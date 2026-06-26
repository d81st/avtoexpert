# Шаблоны документов

В этой папке находятся шаблоны .docx-документов, используемые `Doc_Generator`
(`backend/src/modules/reports/docGenerator.ts`) для генерации заключений.

## Активный шаблон (Docx_Template_V2)

**Файл:** `original_example.docx`

Это единственный production-шаблон, который читает `Doc_Generator`. Соответствует
требованию `R3.1` спека `platform-improvements-mvp`: `Doc_Generator` SHALL
использовать `backend/templates/original_example.docx` в качестве единственного
исходного шаблона. Полный перечень `Docx_Placeholder`, поддерживаемых этим
шаблоном, фиксируется задачей `7.3` (инвентаризация плейсхолдеров) и обновляется
в этом README.

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

## Авторитетная инвентаризация плейсхолдеров (задача 7.3, R3.4)

> Источник истины: фактическое содержимое ZIP-частей `word/document.xml` и
> `word/footer1.xml` файла `original_example.docx`, снятое скриптом
> `backend/scripts/inventory-placeholders.cjs`. Для повторной проверки запустите
> `node scripts/inventory-placeholders.cjs` (вывод в `scripts/inventory-out.json`).
>
> **Зафиксированный снимок инвентаризации (задача 7.3):**
> - Дата инвентаризации: **2026-06-25**
> - Файл: `backend/templates/original_example.docx`
> - Размер: **1 251 091 байт**
> - SHA-256: `8427f254609182a2d01768222d105e1498a53f60e3bafa713526eb48c695c351`
> - Просканированные ZIP-части: `word/document.xml`, `word/footer1.xml`
>
> Результат скрипта на эту дату полностью совпадает с таблицей ниже и с
> зафиксированным `scripts/inventory-out.json`: ровно 4 маркера
> `docxtemplater` (`{#photos}`×1, `{%image}`×1, `{caption}`×1, `{/photos}`×1),
> легаси-слотов `photo_N` нет (`N = 0`), иных скалярных плейсхолдеров и групп
> повторяющихся строк в файле нет.

### Плейсхолдеры, фактически присутствующие в `original_example.docx`

Активный шаблон содержит **ровно один** набор маркеров `docxtemplater` — это
Photo_Insertion_Block (см. раздел ниже). Других плейсхолдеров в шаблоне нет.

| Токен | Тип | Вхождений | Где |
|---|---|---|---|
| `{#photos}` | открытие цикла | 1 | `word/document.xml` |
| `{%image}` | raw image-тег | 1 | `word/document.xml` (внутри цикла) |
| `{caption}` | скалярный | 1 | `word/document.xml` (внутри цикла) |
| `{/photos}` | закрытие цикла | 1 | `word/document.xml` |

Прочие фигурные скобки в XML (`{909E8E84-…}`, `{91240B29-…}` в
`word/document.xml` и `word/footer1.xml`) — это GUID-атрибуты графических
объектов Office (`a14:hiddenFill` / `a14:hiddenLine`), а **не** маркеры
`docxtemplater`; шаблонизатором они не обрабатываются.

**Легаси-слоты `photo_1..photo_N`:** отсутствуют. `N = 0` (фиксированных
слотов фото нет; рендер фото выполняется циклом — design §3.8 supersedes
§3.3/§3.4).

### ⚠️ Расхождение с ожидаемой инвентаризацией design §3.3

Design §3.3 («Placeholder inventory») перечисляет 29 скалярных плейсхолдеров
(`expert_name`, `report_number`, … `grand_total`) и 4 группы повторяющихся
строк (`repair_works`, `paint_works`, `spare_parts`, `materials`). **Ни один
из этих маркеров в текущем файле `original_example.docx` физически
отсутствует.** Шаблон представляет собой готовый (предзаполненный реальными
данными) экспертный отчёт, в который программно (задача 19.10) добавлен только
Photo_Insertion_Block.

Практическое следствие: `DocGenerator.generateDocument()`
(`docGenerator.ts`) передаёт в `doc.render({...})` все 29 скалярных полей и 4
коллекции, но `docxtemplater` **молча игнорирует** данные, для которых в
шаблоне нет соответствующего маркера. Поэтому скалярные/табличные значения
отчёта в итоговый `.docx` сейчас не попадают — заполняется только блок фото.

Ожидаемый design-инвентарь приведён ниже как **референс** для приведения
шаблона в соответствие (добавления недостающих маркеров в `.docx`); он
**не** описывает текущее содержимое файла.

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

### Фотоматериалы (Photo_Insertion_Block, R8.11–R8.14)

Активный шаблон `original_example.docx` содержит **ровно один**
Photo_Insertion_Block — цикл `docxtemplater`, который рендерит все
загруженные фото в порядке `position` (см. `buildPhotoScope(reportId)` в
`docGenerator.ts`, задача 19.9). Блок добавлен программно задачей 19.10 и
заменяет прежнюю схему фиксированных слотов `photo_1..photo_N` (design §3.8
supersedes §3.3/§3.4). Легаси-плейсхолдеры `photo_N` в активном шаблоне
отсутствуют.

```
{#photos}
{%image}
Фото: {caption}
{/photos}
```

- `{#photos}` / `{/photos}` — открывающий и закрывающий токены цикла (по
  одному вхождению каждого в `word/document.xml`).
- `{%image}` — raw-тег для `docxtemplater-image-module-free`; модуль
  подставляет inline-изображение из `scope.photos[i].image` (абсолютный путь,
  задача 9.1). Ровно одно вхождение, внутри цикла.
- `{caption}` — подпись фото из `scope.photos[i].caption` (`null` → пустая
  строка). Ровно одно вхождение, внутри цикла, рядом с литералом `Фото:`.

Пустой массив `photos` рендерится как ноль итераций: ни `<w:drawing>`, ни
абзаца подписи, и сами маркеры в выходной XML не попадают (Property 31).

## Инструкция по созданию шаблона

1. Создайте документ Microsoft Word (.docx)
2. Добавьте плейсхолдеры в фигурных скобках `{placeholder_name}`
3. Для таблиц используйте синтаксис Docxtemplater:
   - `{#array_name}` - начало цикла
   - `{/array_name}` - конец цикла
   - Внутри цикла используйте имена полей массива
4. Сохраните файл как `original_example.docx` в этой папке

## Пример

Для создания таблицы ремонтных работ:

```
{#repair_works}
Название детали: {part_name}
Тип: {part_type}
Сложность: {complexity}
Стоимость: {price}
{/repair_works}
```

Это создаст строки для каждого элемента массива repair_works.
