import { Loader2 } from 'lucide-react';
import type { UseFormRegister } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Shape of the search form managed by `useDashboard`.
 *
 * Kept local to this module so that consumers don't need to import a separate
 * type; mirrors the `SearchForm` interface in `useDashboard.ts`.
 */
export interface DashboardSearchForm {
  search: string;
}

export interface DashboardSearchBarProps {
  /** RHF `register` from the dashboard's search form. */
  register: UseFormRegister<DashboardSearchForm>;
  /**
   * Reflects the underlying TanStack Query `isFetching` flag of the reports
   * list. Controls the inline spinner only — never the mount/disabled state
   * of the input (Requirements 1.1–1.4).
   */
  isFetching: boolean;
  /**
   * Currently committed (debounced) search query. Used to decide whether the
   * clear button should be rendered. Does NOT influence the input's mount
   * state.
   */
  searchQuery: string;
  /** Invoked when the user clicks the clear button. */
  onClear: () => void;
}

/**
 * Dashboard search bar.
 *
 * The `<Input>` is rendered unconditionally in a stable position in the React
 * tree so that focus, caret position and IME composition are preserved across
 * fetch state transitions (Requirements 1.1, 1.2, 1.6). The fetch indicator
 * (`<Loader2 />`) is a sibling that toggles based on `isFetching` — toggling
 * it does not unmount or replace the input (Requirements 1.3, 1.4).
 */
export function DashboardSearchBar({
  register,
  isFetching,
  searchQuery,
  onClear,
}: DashboardSearchBarProps) {
  return (
    <section
      data-testid="dashboard-search-bar"
      className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <div className="relative flex-1">
        <Input
          type="text"
          placeholder="Поиск по номеру, госномеру, владельцу..."
          data-testid="dashboard-search-input"
          {...register('search')}
        />
        {isFetching && (
          <Loader2
            aria-label="Загрузка"
            data-testid="dashboard-search-spinner"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground"
          />
        )}
      </div>
      {searchQuery && (
        <Button
          type="button"
          variant="outline"
          onClick={onClear}
          data-testid="dashboard-search-clear"
        >
          Сбросить
        </Button>
      )}
    </section>
  );
}

export default DashboardSearchBar;
