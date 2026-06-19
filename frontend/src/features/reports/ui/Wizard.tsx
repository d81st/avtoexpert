import { type ReactNode } from "react";

interface WizardProps {
  children: ReactNode;
  currentStep: number;
  totalSteps: number;
}

function Wizard({ children, currentStep, totalSteps }: WizardProps) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="surface-card mb-6 rounded-3xl p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
              Мастер заполнения
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Выполнено шагов: {currentStep} из {totalSteps}
            </p>
          </div>
          <div className="badge-soft bg-blue-50 text-blue-700">
            Шаг {currentStep}/{totalSteps}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2 md:gap-3">
          {[...Array(totalSteps)].map((_, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentStep;
            const isActive = stepNumber === currentStep;

            return (
              <div key={index} className="text-center">
                <div
                  className={`mx-auto flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold transition-all ${
                    isCompleted
                      ? "bg-emerald-100 text-emerald-700"
                      : isActive
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {isCompleted ? "✓" : stepNumber}
                </div>
                <div
                  className={`mt-2 text-[11px] font-medium ${isActive ? "text-blue-700" : "text-slate-500"}`}
                >
                  Шаг {stepNumber}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="surface-card rounded-3xl p-6 md:p-8">{children}</div>
    </div>
  );
}

export default Wizard;
