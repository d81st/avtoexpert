import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { AppAlert } from '@/components/ui/app-alert';
import { Button } from '@/components/ui/button';
import { type Step5FormData, step5Schema } from '@/schemas/step5.schema';
import { formatSum } from '@/shared/lib/formatters';
import { notify } from '@/shared/notifications/notify';
import type { CooldownReason } from '../hooks/useReportFinalize';
import { useValidationSync } from '../hooks/useValidationSync';
import { calcGrandTotal } from '../lib/calculations';
import { usePhotosQuery } from '../model/reportQueries';
import { useFormStore } from '../model/useFormStore';
import type { ReportPhoto } from '../types';
import { FormStoreSync } from './fields/isolated-fields';
import PhotoUploader from './PhotoUploader';

interface Step5Props {
  onValidationChange: (isValid: boolean) => void;
  onFinalize: () => Promise<void>;
  isGenerating: boolean;
  generateError: string | null;
  generateSuccess: boolean;
  cooldownReason: CooldownReason;
  cooldownSecondsLeft: number;
}

function Step5({
  onValidationChange,
  onFinalize,
  isGenerating,
  generateError,
  generateSuccess,
  cooldownReason,
  cooldownSecondsLeft,
}: Step5Props) {
  const step5Data = useFormStore((s) => s.step5);
  const setStep5 = useFormStore((s) => s.setStep5);
  const { step3, step4 } = useFormStore();
  const { id: reportId } = useParams<{ id: string }>();

  // Photos are owned by the self-contained PhotoUploader (R4.1), which manages
  // upload/delete and surfaces its own Notification_System errors. Step5 only
  // reads the same `usePhotosQuery` cache so the finalize button can gate on the
  // photo count and so the FormStore stays in sync for `updateStep5` on
  // generate (see useReportFinalize).
  const photosQuery = usePhotosQuery(reportId);
  const photos: ReportPhoto[] = photosQuery.data ?? [];

  const form = useForm<Step5FormData>({
    resolver: zodResolver(step5Schema),
    mode: 'onChange',
    defaultValues: step5Data ?? { photos: [] },
  });

  const { control, setValue } = form;

  // Sync photos from the query cache into react-hook-form; FormStoreSync below
  // then mirrors them into the Zustand FormStore (consumed by updateStep5).
  useEffect(() => {
    setValue('photos', photos);
  }, [photos, setValue]);

  // AC 5.4 — transient generate error → toast. Состояние `generateError`
  // принадлежит `useReportFinalize` и сбрасывается на каждом следующем вызове
  // `handleFinalize` (см. setGenerateError(null) в начале finalize-цикла),
  // что обеспечивает идемпотентность: ровно один toast на одну попытку.
  useEffect(() => {
    if (!generateError) return;
    notify.error(generateError);
  }, [generateError]);

  // AC 5.3 — transient generate success → toast. `generateSuccess` устанавливается
  // ровно один раз за успешный finalize-цикл и сбрасывается в `false` на следующей
  // попытке внутри `useReportFinalize`, что обеспечивает идемпотентность.
  useEffect(() => {
    if (!generateSuccess) return;
    notify.success('Документ успешно сгенерирован и скачан!');
  }, [generateSuccess]);

  // Step5 is always valid (photos are optional) — notify parent via validation sync hook
  useValidationSync(true, onValidationChange);

  const depreciationPct = step3?.depreciation_pct ?? 90;
  const totals = step4
    ? calcGrandTotal({
        repairWorks: step4.repair_works,
        paintWorks: step4.paint_works,
        spareParts: step4.spare_parts,
        materials: step4.materials,
        depreciationPct,
      })
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Шаг 5: Yakunlash</h2>
        <p className="text-sm text-gray-600 mt-2">Фотографии повреждений и итоговые суммы</p>
      </div>

      {/* Isolated, debounced Zustand sync — keeps the whole-form watch off this
          component's render path (R1.3). */}
      <FormStoreSync control={control} setter={setStep5} />

      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">5.1 - Фотографии / Rasmlar</h3>

        {reportId ? (
          <PhotoUploader reportId={reportId} />
        ) : (
          <AppAlert type="info" message="Сначала сохраните шаг 1, чтобы загрузить фотографии" />
        )}
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          5.2 - Итоговые суммы / Yakuniy summalar
        </h3>

        {!step4 ? (
          <AppAlert type="info" message="Заполните шаг 4 для просмотра итогов" />
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span>Итого за работы / Ishlar jami</span>
              <strong>{formatSum(totals?.totalWorks)}</strong>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span>Итого запчасти (полная) / Ehtiyot qismlar</span>
              <strong>{formatSum(totals?.totalSparePartsFull)}</strong>
            </div>
            <div className="flex justify-between p-3 bg-green-50 rounded">
              <span>Итого запчасти с износом ({depreciationPct}%) / Eskirish bilan</span>
              <strong className="text-green-700">
                {formatSum(totals?.totalSparePartsWithWear)}
              </strong>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span>Итого материалы / Materiallar</span>
              <strong>{formatSum(totals?.totalMaterials)}</strong>
            </div>
            <div className="flex justify-between p-4 bg-blue-600 text-white rounded-lg">
              <span className="text-lg font-medium">Общая сумма / Umumiy summa</span>
              <strong className="text-2xl">{formatSum(totals?.grandTotal)}</strong>
            </div>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">5.3 - Генерация документа</h3>

        <Button
          onClick={onFinalize}
          disabled={isGenerating || cooldownSecondsLeft > 0 || !step4 || photos.length === 0}
          variant="success"
          size="lg"
          className="w-full"
        >
          {cooldownReason === 'rate-limit'
            ? `Подождите ${cooldownSecondsLeft} с`
            : isGenerating
              ? 'Генерация...'
              : generateSuccess
                ? 'Готово!'
                : photos.length === 0
                  ? 'Загрузите хотя бы 1 фото'
                  : 'Скачать заключение .docx'}
        </Button>
      </section>
    </div>
  );
}

export default Step5;
