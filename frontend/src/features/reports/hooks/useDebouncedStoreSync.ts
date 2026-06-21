import { useEffect, useRef } from 'react';
import { type Control, type FieldValues, useWatch } from 'react-hook-form';

/**
 * Хук для debounced-синхронизации данных формы с Zustand store.
 * Заменяет паттерн useWatch + useEffect, снижая частоту обновлений store.
 *
 * @param control - Control объект из react-hook-form
 * @param setter - Функция-сеттер Zustand store
 * @param delay - Задержка debounce в мс (default: 300)
 */
export function useDebouncedStoreSync<T extends FieldValues>(
  control: Control<T>,
  setter: (data: T) => void,
  delay: number = 300,
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchedValues = useWatch({ control });

  useEffect(() => {
    if (watchedValues && Object.keys(watchedValues).length > 0) {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        setter(watchedValues as T);
        timerRef.current = null;
      }, delay);
    }

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [watchedValues, setter, delay]);
}
