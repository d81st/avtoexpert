# Requirements Document

## Введение

Оптимизация фронтенда приложения AvtoExpert Pro (React 19 + Vite 8 + Tailwind CSS v4 + Zod v4 + React Hook Form 7.79 + Zustand 5 + Radix UI). Исправление 5 критических проблем: производительность форм, отсутствие CSS-переменных для shadcn/ui компонентов, отсутствие состояния загрузки кнопки "Далее", ошибка валидации repair_works на этапе загрузки документа, и несовместимость схем с Zod v4.

## Glossary

- **Form_Store**: Глобальное хранилище Zustand, содержащее данные всех шагов визарда (step1–step5)
- **Wizard_Navigation**: Компонент навигации между шагами формы с кнопками "Назад" и "Далее"
- **Step4_Component**: Компонент шага 4 визарда, содержащий динамические массивы ремонтных работ, покрасочных работ, запчастей и материалов
- **Step5_Component**: Компонент шага 5 визарда, отвечающий за загрузку фото и генерацию документа
- **Schema_Validator**: Zod-схемы (step2Schema, step3Schema, step4Schema) для валидации данных формы
- **CSS_Theme_Layer**: Слой CSS-переменных в index.css, определяющий цвета для shadcn/ui компонентов
- **Debounced_Sync**: Механизм синхронизации данных формы с Form_Store с задержкой для снижения частоты обновлений
- **Save_Mutation**: Асинхронная операция сохранения данных шага на сервер через React Query мутацию

## Requirements

### Requirement 1: Оптимизация производительности синхронизации формы с хранилищем

**User Story:** Как пользователь, я хочу чтобы форма шага 4 работала плавно при вводе данных, чтобы я мог быстро заполнять информацию о ремонтных работах без задержек интерфейса.

#### Acceptance Criteria

1. WHEN a user types in any field of Step4_Component, THE Debounced_Sync SHALL delay synchronization with Form_Store by 300ms after the last keystroke
2. WHEN a user types in any field of Step5_Component, THE Debounced_Sync SHALL delay synchronization with Form_Store by 300ms after the last keystroke
3. WHILE Debounced_Sync is waiting for the delay period, THE Step4_Component SHALL NOT trigger a re-render of the entire component tree
4. WHEN the debounce timer expires, THE Debounced_Sync SHALL synchronize the current form values to Form_Store in a single batch update

### Requirement 2: Определение CSS-переменных для shadcn/ui компонентов

**User Story:** Как пользователь, я хочу чтобы модальные окна и выпадающие списки имели корректный непрозрачный фон, чтобы контент за ними не просвечивал и интерфейс выглядел целостно.

#### Acceptance Criteria

1. THE CSS_Theme_Layer SHALL define the `--background` CSS variable with an opaque color value in the `:root` selector
2. THE CSS_Theme_Layer SHALL define the `--foreground` CSS variable with a text color value in the `:root` selector
3. THE CSS_Theme_Layer SHALL define the `--popover` CSS variable with an opaque background color value in the `:root` selector
4. THE CSS_Theme_Layer SHALL define the `--popover-foreground` CSS variable with a text color value in the `:root` selector
5. THE CSS_Theme_Layer SHALL define the `--border`, `--input`, `--ring`, `--accent`, `--accent-foreground`, `--muted`, `--muted-foreground`, `--card`, `--card-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--destructive`, `--destructive-foreground` CSS variables in the `:root` selector
6. WHEN a Dialog component renders, THE CSS_Theme_Layer SHALL ensure `bg-background` resolves to an opaque white or near-white color
7. WHEN a Select dropdown opens, THE CSS_Theme_Layer SHALL ensure `bg-popover` resolves to an opaque white or near-white color

### Requirement 3: Состояние загрузки кнопки "Далее" при сохранении шага

**User Story:** Как пользователь, я хочу видеть индикатор загрузки на кнопке "Далее" во время сохранения данных, чтобы я понимал что процесс идёт и не нажимал кнопку повторно.

#### Acceptance Criteria

1. WHILE Save_Mutation is in pending state, THE Wizard_Navigation SHALL disable the "Далее" button
2. WHILE Save_Mutation is in pending state, THE Wizard_Navigation SHALL display a loading spinner inside the "Далее" button
3. WHEN Save_Mutation transitions from idle to pending, THE Wizard_Navigation SHALL replace the button text "Далее →" with a spinner and text "Сохранение..."
4. WHEN Save_Mutation completes successfully, THE Wizard_Navigation SHALL restore the button to its normal enabled state

### Requirement 4: Валидация наличия ремонтных работ на уровне формы

**User Story:** Как пользователь, я хочу получать ошибку валидации прямо на шаге 4 если не добавил ни одной ремонтной работы, чтобы не узнавать об этом только при попытке скачать документ.

#### Acceptance Criteria

1. THE Schema_Validator SHALL enforce a minimum of 1 element in the `repair_works` array in step4Schema
2. WHEN a user has zero repair works in Step4_Component, THE Schema_Validator SHALL report the form as invalid
3. WHEN a user has zero repair works in Step4_Component, THE Schema_Validator SHALL display the validation message "Добавьте минимум одну ремонтную работу"
4. WHEN a user adds at least one repair work with a non-empty part_name, THE Schema_Validator SHALL allow progression to the next step

### Requirement 5: Исправление совместимости схем с Zod v4

**User Story:** Как разработчик, я хочу чтобы Zod-схемы использовали корректный API Zod v4, чтобы устранить ошибки TypeScript и обеспечить корректную работу валидации.

#### Acceptance Criteria

1. THE Schema_Validator SHALL use `z.number({ error: "..." })` instead of `z.number({ required_error: "..." })` in step2Schema for Zod v4 compatibility
2. THE Schema_Validator SHALL use `z.number({ error: "..." })` instead of `z.number({ required_error: "..." })` in step3Schema for Zod v4 compatibility
3. THE Schema_Validator SHALL use `z.number({ error: "..." })` instead of `z.number({ required_error: "..." })` in step4Schema for Zod v4 compatibility
4. THE Schema_Validator SHALL use `z.enum([...], { error: "..." })` instead of `z.enum([...], { required_error: "..." })` in step2Schema and step3Schema for Zod v4 compatibility
5. WHEN the project is compiled with TypeScript, THE Schema_Validator SHALL produce zero type errors in step2.schema.ts, step3.schema.ts, and step4.schema.ts
