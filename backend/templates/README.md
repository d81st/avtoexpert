# Шаблоны документов

В этой папке должны находиться шаблоны .docx документов для генерации заключений.

## Требуемый шаблон

**Файл:** `expertise.docx`

### Плейсхолдеры для подстановки данных:

#### Основные данные:
- `{expert_name}` - ФИО эксперта
- `{report_number}` - Номер заключения
- `{report_date}` - Дата заключения
- `{application_date}` - Дата поступления заявки

#### Данные автомобиля:
- `{car_model}` - Модель автомобиля
- `{car_year}` - Год выпуска
- `{car_color}` - Цвет
- `{body_type}` - Тип кузова
- `{license_plate}` - Госномер
- `{owner_name}` - ФИО владельца
- `{tech_passport}` - Техпаспорт
- `{tech_passport_place}` - Место выдачи техпаспорта
- `{mileage}` - Пробег (км)
- `{odometer_status}` - Статус одометра
- `{vin_code}` - VIN-код
- `{engine_number}` - Номер двигателя
- `{transmission_type}` - Тип трансмиссии

#### Рыночная стоимость:
- `{production_status}` - Статус производства
- `{analog1_mileage}` - Пробег аналога 1
- `{analog1_price}` - Цена аналога 1
- `{analog2_mileage}` - Пробег аналога 2
- `{analog2_price}` - Цена аналога 2
- `{analog3_mileage}` - Пробег аналога 3
- `{analog3_price}` - Цена аналога 3
- `{factory_price}` - Цена нового (с завода)
- `{depreciation_pct}` - % физического износа
- `{market_price}` - Рыночная стоимость

#### Ремонт:
- `{hourly_rate}` - Нормо-час

#### Итоги:
- `{grand_total}` - Общая сумма

### Таблицы (для динамических данных):

#### Ремонтные работы:
```
{#repair_works}
{part_name} | {part_type} | {complexity} | {price}
{/repair_works}
```

#### Покрасочные работы:
```
{#paint_works}
{part_name} | {paint_price} | {polish_price}
{/paint_works}
```

#### Запчасти:
```
{#spare_parts}
{name} | {qty} | {price}
{/spare_parts}
```

#### Материалы:
```
{#materials}
{name} | {qty} | {price}
{/materials}
```

## Инструкция по созданию шаблона

1. Создайте документ Microsoft Word (.docx)
2. Добавьте плейсхолдеры в фигурных скобках `{placeholder_name}`
3. Для таблиц используйте синтаксис Docxtemplater:
   - `{#array_name}` - начало цикла
   - `{/array_name}` - конец цикла
   - Внутри цикла используйте имена полей массива
4. Сохраните файл как `expertise.docx` в этой папке

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
