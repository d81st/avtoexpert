import Button from "./Button";

interface WizardNavigationProps {
  onNext: () => void;
  onPrevious: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
  isLastStep: boolean;
}

function WizardNavigation({
  onNext,
  onPrevious,
  canGoNext,
  canGoPrevious,
  isLastStep,
}: WizardNavigationProps) {
  return (
    <div className="mt-8 flex justify-between gap-4 border-t border-slate-200 pt-6">
      <Button
        onClick={onPrevious}
        disabled={!canGoPrevious}
        variant="secondary"
        size="md"
      >
        ← Назад
      </Button>

      {isLastStep ? (
        <Button
          onClick={onNext}
          disabled={!canGoNext}
          variant="success"
          size="md"
        >
          ✓ Завершить
        </Button>
      ) : (
        <Button
          onClick={onNext}
          disabled={!canGoNext}
          variant="primary"
          size="md"
        >
          Далее →
        </Button>
      )}
    </div>
  );
}

export default WizardNavigation;
