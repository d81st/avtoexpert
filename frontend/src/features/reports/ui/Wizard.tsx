import { type ReactNode } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
            <p className="gradient-text text-xs font-semibold uppercase tracking-[0.2em]">
              Мастер заполнения
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Выполнено шагов: {currentStep} из {totalSteps}
            </p>
          </div>
          <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
            Шаг {currentStep}/{totalSteps}
          </Badge>
        </div>
        <div className="gradient-divider mt-2 mb-4" />

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
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : stepNumber}
                </div>
                <div
                  className={`mt-2 text-[11px] font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}
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
