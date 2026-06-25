import { useEffect, useState } from "react";
import { useFormStore } from "../model/useFormStore";
import { reportService } from "../api/reportApi";
import {
  AUTOSAVE_ELIGIBLE_STEPS,
  AUTOSAVE_INTERVAL_MS,
  type AutosaveEligibleStep,
} from "../lib/autosave.config";
import { notify } from "@/shared/notifications/notify";

interface UseReportAutosaveParams {
  reportId?: string;
  currentStep: number;
}

export interface UseReportAutosaveReturn {
  isSaving: boolean;
}

function isAutosaveEligibleStep(step: number): step is AutosaveEligibleStep {
  return (AUTOSAVE_ELIGIBLE_STEPS as readonly number[]).includes(step);
}

/**
 * Хук автосохранения мастера заключения.
 *
 * Планирует одиночный таймер на {@link AUTOSAVE_INTERVAL_MS}; при каждом
 * изменении полей `step2`/`step3`/`step4` или смене `currentStep`/`reportId`
 * cleanup отменяет предыдущий таймер и effect запускает новый — таким
 * образом одновременно существует не более одного запланированного таймера
 * (AC 3.5, 3.6).
 *
 * Контракты:
 * - AC 3.1, 3.2 — задержка читается только из `AUTOSAVE_INTERVAL_MS`;
 *   числовых литералов задержки в этом файле нет.
 * - AC 3.4 — таймер не планируется при отсутствии `reportId` или вне
 *   множества {@link AUTOSAVE_ELIGIBLE_STEPS}.
 * - AC 3.7, 3.8 — `isSaving = true` перед запросом, `false` в `finally`.
 * - AC 3.9 — ошибка передаётся в `notify.error` (Notification_System).
 * - AC 3.10 — `useFormStore` не мутируется ни в success, ни в error ветке;
 *   несохранённые значения остаются доступны для следующего цикла.
 * - AC 4.4 — запрос помечен `background: true`, чтобы не учитываться в
 *   Global_Loading_Manager и не показывать overlay.
 */
export function useReportAutosave({
  reportId,
  currentStep,
}: UseReportAutosaveParams): UseReportAutosaveReturn {
  // Подписываемся точечно на нужные поля стора, чтобы хук не ре-рендерился
  // на изменения других полей (`step1`, `step5`, `currentStep`, ...).
  const step2 = useFormStore((s) => s.step2);
  const step3 = useFormStore((s) => s.step3);
  const step4 = useFormStore((s) => s.step4);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // AC 3.4 — guard до планирования таймера; ранее запланированный таймер
    // отменяется cleanup-функцией предыдущего effect.
    if (!reportId || !isAutosaveEligibleStep(currentStep)) return;

    // AC 3.10 — snapshot значений на момент планирования; useFormStore
    // не мутируется ни здесь, ни в success/error ветках.
    const snapshot = { step2, step3, step4 };

    const timeoutId = setTimeout(async () => {
      setIsSaving(true); // AC 3.7
      try {
        // AC 4.4 — background-запрос не влияет на Global_Loading_Manager.
        await reportService.autosave(reportId, snapshot, { background: true });
      } catch {
        // AC 3.9 — индикация ошибки идёт через Notification_System.
        // AC 3.10 — состояние useFormStore не трогаем; данные остаются
        // для следующего цикла автосохранения.
        notify.error("Не удалось сохранить черновик", {
          description:
            "Изменения сохранены локально и будут отправлены при следующем автосейве.",
        });
      } finally {
        setIsSaving(false); // AC 3.8
      }
    }, AUTOSAVE_INTERVAL_MS);

    // AC 3.5 — cleanup отменяет таймер при смене deps.
    return () => clearTimeout(timeoutId);
  }, [currentStep, reportId, step2, step3, step4]);

  return { isSaving };
}
