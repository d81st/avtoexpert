export function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return '—';
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('ru-RU');
}

export function formatSum(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }

  return `${value.toLocaleString('ru-RU')} сум`;
}

export function formatProgress(currentStep: number, totalSteps = 5): string {
  return `${currentStep}/${totalSteps}`;
}
