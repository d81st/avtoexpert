import { useCallback, useState } from "react";

export function useEditableList<T>(initialItems: T[] = []) {
  const [items, setItems] = useState<T[]>(initialItems);

  const replaceItems = useCallback((nextItems: T[]) => {
    setItems(nextItems);
  }, []);

  const addItem = useCallback((item: T) => {
    const nextItems = [...items, item];
    setItems(nextItems);
    return nextItems;
  }, [items]);

  const updateItem = useCallback(
    (index: number, patch: Partial<T>) => {
      const nextItems = [...items];
      nextItems[index] = { ...nextItems[index], ...patch };
      setItems(nextItems);
      return nextItems;
    },
    [items],
  );

  const removeItem = useCallback((index: number) => {
    const nextItems = items.filter((_, itemIndex) => itemIndex !== index);
    setItems(nextItems);
    return nextItems;
  }, [items]);

  return {
    items,
    setItems,
    replaceItems,
    addItem,
    updateItem,
    removeItem,
  };
}
