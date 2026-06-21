# Implementation Plan: Исправление Select dropdown и генерации документов

## Overview

Два независимых исправления: CSS-тема для Tailwind v4 (frontend) и маппинг полей коллекций в DocGenerator (backend). Задачи сгруппированы по подсистемам.

## Tasks

- [x] 1. Fix CSS theme tokens for Tailwind v4 compatibility
  - [x] 1.1 Add `@theme` block to `frontend/src/index.css`
    - Add `@theme` directive after `@import "tailwindcss"` with color mappings for all shadcn/ui tokens
    - Map each CSS variable to its Tailwind v4 theme token: `--color-background`, `--color-foreground`, `--color-popover`, `--color-popover-foreground`, `--color-card`, `--color-card-foreground`, `--color-primary`, `--color-primary-foreground`, `--color-secondary`, `--color-secondary-foreground`, `--color-muted`, `--color-muted-foreground`, `--color-accent`, `--color-accent-foreground`, `--color-destructive`, `--color-destructive-foreground`, `--color-border`, `--color-input`, `--color-ring`
    - Use `hsl()` wrapper around existing bare HSL values from `:root` variables
    - Also add `--radius` to `@theme` for border-radius utilities
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Verify frontend builds without errors
    - Run `npm run build` in frontend directory
    - Confirm no Tailwind compilation errors
    - _Requirements: 1.1, 3.1_

- [x] 2. Fix DocGenerator field mapping
  - [x] 2.1 Add collection mapping functions to `backend/src/modules/reports/docGenerator.ts`
    - Create `mapRepairWorks(items)`: maps `partName`→`part_name`, `partType`→`part_type`, keeps `complexity`, `price`; coalesces nulls to `''` for strings and `0` for numbers
    - Create `mapPaintWorks(items)`: maps `partName`→`part_name`, `paintPrice`→`paint_price`, `polishPrice`→`polish_price`; coalesces nulls
    - Create `mapSpareParts(items)`: selects `name`, `qty`, `price`; coalesces nulls
    - Create `mapMaterials(items)`: selects `name`, `qty`, `price`; coalesces nulls
    - Apply these mappers in `generateDocument()` before passing to `doc.render()`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 Improve error handling in `generateDocument()` catch block
    - Include original error message in the thrown Error: `Document generation error: ${originalMessage}`
    - Pass original error as `cause` option: `{ cause: error }`
    - Keep existing `logger.error` call but add original message to structured data
    - _Requirements: 2.5_

  - [ ]* 2.3 Write property tests for collection mapping functions
    - Install `fast-check` as dev dependency if not present
    - Create test file `backend/src/modules/reports/__tests__/docGenerator.test.ts`
    - **Property 1: RepairWorks field mapping preserves values**
    - **Validates: Requirements 2.1**
    - **Property 2: PaintWorks field mapping preserves values**
    - **Validates: Requirements 2.2**
    - **Property 3: SpareParts and Materials field mapping preserves values**
    - **Validates: Requirements 2.3, 2.4**
    - Each property test: minimum 100 iterations
    - Tag format: `Feature: bugfix-select-and-docgen, Property N: ...`

  - [ ]* 2.4 Write unit tests for error handling improvement
    - Test that thrown error message contains original error text
    - Test that `error.cause` is set to original error
    - Test with mock template that causes docxtemplater to fail
    - _Requirements: 2.5_

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Verify backward compatibility
  - [x] 4.1 Verify Select component renders correctly
    - Confirm `bg-popover` resolves to a valid background in SelectContent
    - Confirm existing component classes (shadows, animations, borders) still function
    - _Requirements: 3.1_

  - [x] 4.2 Verify scalar fields in DocGenerator remain unaffected
    - Confirm that scalar mapping (expert_name, car_model, etc.) is unchanged
    - Confirm that the existing `doc.render()` call structure is preserved for top-level fields
    - _Requirements: 3.2_

- [x] 5. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Bug 1 (CSS) and Bug 2 (DocGenerator) are independent — can be implemented in any order
- Property tests use `fast-check` library for TypeScript
- The CSS fix benefits all shadcn/ui components, not just Select
