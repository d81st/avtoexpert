# Requirements Document

## Introduction

Исправление двух багов в проекте AvtoExpert Pro:
1. **Select dropdown** — выпадающий список (SelectContent) не имеет непрозрачного фона из-за несовместимости CSS-переменных shadcn/ui с Tailwind CSS v4.
2. **Генерация документов** — ошибка при генерации .docx заключения из-за несовпадения имён полей между данными из БД и плейсхолдерами шаблона, а также недостаточной информации в сообщении об ошибке.

## Glossary

- **Select_Component**: UI-компонент выпадающего списка (shadcn/ui Select на базе Radix UI)
- **SelectContent**: Выпадающее содержимое Select_Component, отображаемое через Portal
- **Tailwind_V4**: Tailwind CSS версии 4, использующий `@theme` директиву для пользовательских токенов
- **CSS_Variables**: Пользовательские переменные CSS (custom properties), определённые в `:root`
- **DocGenerator**: Класс бэкенда, генерирующий .docx файл на основе шаблона и данных отчёта
- **Template_Placeholders**: Плейсхолдеры в шаблоне expertise.docx в формате snake_case (e.g. `{part_name}`)
- **Database_Fields**: Поля объектов из БД в формате camelCase (e.g. `partName`)
- **Docxtemplater**: Библиотека для подстановки данных в .docx шаблоны

## Requirements

### Requirement 1: Исправление фона Select dropdown

**User Story:** Как пользователь, я хочу видеть выпадающий список Select с непрозрачным белым фоном, чтобы содержимое за ним не просвечивало и было комфортно выбирать значение.

#### Acceptance Criteria

1. WHEN CSS_Variables для shadcn/ui определены в `:root`, THE Tailwind_V4 SHALL корректно разрешать утилитарные классы `bg-popover`, `bg-background`, `bg-card` и прочие семантические цвета в валидные CSS-значения
2. WHEN SelectContent отображается поверх страницы, THE Select_Component SHALL иметь непрозрачный фон, полностью перекрывающий контент позади
3. WHEN тема переключается (если поддерживается в будущем), THE CSS_Variables SHALL оставаться совместимыми с директивой `@theme` Tailwind_V4

### Requirement 2: Исправление маппинга полей при генерации документов

**User Story:** Как пользователь, я хочу успешно скачивать заключение в формате .docx, чтобы передать его клиенту.

#### Acceptance Criteria

1. WHEN DocGenerator получает массив repairWorks из БД с полями в camelCase, THE DocGenerator SHALL преобразовать каждый объект в формат с полями `part_name`, `part_type`, `complexity`, `price` перед передачей в шаблон
2. WHEN DocGenerator получает массив paintWorks из БД с полями в camelCase, THE DocGenerator SHALL преобразовать каждый объект в формат с полями `part_name`, `paint_price`, `polish_price` перед передачей в шаблон
3. WHEN DocGenerator получает массив spareParts из БД с полями в camelCase, THE DocGenerator SHALL преобразовать каждый объект в формат с полями `name`, `qty`, `price` перед передачей в шаблон
4. WHEN DocGenerator получает массив materials из БД с полями в camelCase, THE DocGenerator SHALL преобразовать каждый объект в формат с полями `name`, `qty`, `price` перед передачей в шаблон
5. IF ошибка происходит при рендеринге шаблона, THEN THE DocGenerator SHALL включить оригинальное сообщение об ошибке и стек-трейс в пробрасываемое исключение

### Requirement 3: Сохранение обратной совместимости

**User Story:** Как разработчик, я хочу чтобы исправления не сломали существующую функциональность остальных компонентов UI и других эндпоинтов API.

#### Acceptance Criteria

1. WHEN CSS_Variables обновлены для совместимости с Tailwind_V4, THE Select_Component SHALL сохранять анимации и стили (тени, border-radius, padding), определённые в компоненте
2. WHEN DocGenerator маппит поля коллекций, THE DocGenerator SHALL не изменять скалярные поля верхнего уровня отчёта (expert_name, car_model и т.д.), которые уже корректно маппятся
