import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WizardNavigationProps {
  onNext: () => void;
  onPrevious: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
  isLastStep: boolean;
  isSaving?: boolean;
}

function WizardNavigation({
  onNext,
  onPrevious,
  canGoNext,
  canGoPrevious,
  isLastStep,
  isSaving,
}: WizardNavigationProps) {
  return (
    <div className="mt-8 flex justify-between gap-4 border-t border-slate-200 pt-6">
      <Button onClick={onPrevious} disabled={!canGoPrevious} variant="outline">
        ← Назад
      </Button>

      {isLastStep ? (
        <Button onClick={onNext} disabled={!canGoNext || isSaving} variant="success">
          ✓ Завершить
        </Button>
      ) : (
        <Button onClick={onNext} disabled={!canGoNext || isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="animate-spin" />
              Сохранение...
            </>
          ) : (
            'Далее →'
          )}
        </Button>
      )}
    </div>
  );
}

export default WizardNavigation;
