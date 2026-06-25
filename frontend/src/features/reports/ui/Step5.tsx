import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MAX_PHOTOS } from "@/constants/reference";
import { formatSum } from "@/shared/lib/formatters";
import { step5Schema, type Step5FormData } from "@/schemas/step5.schema";
import { useDebouncedStoreSync } from "../hooks/useDebouncedStoreSync";
import { usePhotoUpload } from "../hooks/usePhotoUpload";
import { useValidationSync } from "../hooks/useValidationSync";
import { useFormStore } from "../model/useFormStore";
import { calcGrandTotal } from "../lib/calculations";
import type { CooldownReason } from "../hooks/useReportFinalize";
import { AppAlert } from "@/components/ui/app-alert";
import { notify } from "@/shared/notifications/notify";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

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

  const {
    photos,
    uploading,
    uploadError,
    setUploadError,
    isDragging,
    handleFileInput,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    removePhoto,
  } = usePhotoUpload();

  const form = useForm<Step5FormData>({
    resolver: zodResolver(step5Schema),
    mode: "onChange",
    defaultValues: step5Data ?? { photos: [] },
  });

  const { control, setValue } = form;

  // Sync photos from usePhotoUpload into react-hook-form
  useEffect(() => {
    setValue("photos", photos);
  }, [photos, setValue]);

  // AC 5.4 — transient upload error отображается toast'ом через
  // Notification_System, а не inline AppAlert. После показа сразу сбрасываем
  // локальное состояние из usePhotoUpload, чтобы повторное появление того же
  // текста снова срабатывало (effect зависит от перехода `uploadError → truthy`).
  useEffect(() => {
    if (!uploadError) return;
    notify.error(uploadError);
    setUploadError(null);
  }, [uploadError, setUploadError]);

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
    notify.success("Документ успешно сгенерирован и скачан!");
  }, [generateSuccess]);

  // Debounced sync form data with FormStore
  useDebouncedStoreSync(control, setStep5, 300);

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
        <p className="text-sm text-gray-600 mt-2">
          Фотографии повреждений и итоговые суммы
        </p>
      </div>

      <Form {...form}>
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            5.1 - Фотографии / Rasmlar
          </h3>

          <FormField
            control={control}
            name="photos"
            render={() => (
              <FormItem>
                <FormLabel>Фотографии повреждений</FormLabel>
                <FormControl>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                      isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
                      onChange={handleFileInput}
                      className="hidden"
                      id="photo-upload"
                      disabled={uploading || photos.length >= MAX_PHOTOS}
                    />
                    <label
                      htmlFor="photo-upload"
                      className={`cursor-pointer block ${uploading || photos.length >= MAX_PHOTOS ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="text-4xl mb-3">Фото</div>
                      <p className="text-gray-700 font-medium">
                        {uploading
                          ? "Загрузка..."
                          : "Перетащите файлы или нажмите для выбора"}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        JPG, PNG, HEIC - до {MAX_PHOTOS} фото
                      </p>
                      <p className="text-sm font-medium text-blue-600 mt-3">
                        Загружено: {photos.length} из {MAX_PHOTOS}
                      </p>
                    </label>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {photos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {photos.map((photo, index) => (
                <div key={photo.id} className="relative group">
                  <img
                    src={photo.url}
                    alt={`Фото ${index + 1}`}
                    className="w-full h-36 object-cover rounded-lg border-2 border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void removePhoto(photo);
                    }}
                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    x
                  </button>
                  <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                    {index + 1}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </Form>

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
              <span>
                Итого запчасти с износом ({depreciationPct}%) / Eskirish bilan
              </span>
              <strong className="text-green-700">{formatSum(totals?.totalSparePartsWithWear)}</strong>
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
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          5.3 - Генерация документа
        </h3>

        <Button
          onClick={onFinalize}
          disabled={
            isGenerating ||
            cooldownSecondsLeft > 0 ||
            !step4 ||
            photos.length === 0
          }
          variant="success"
          size="lg"
          className="w-full"
        >
          {cooldownReason === "rate-limit"
            ? `Подождите ${cooldownSecondsLeft} с`
            : isGenerating
              ? "Генерация..."
              : generateSuccess
                ? "Готово!"
                : photos.length === 0
                  ? "Загрузите хотя бы 1 фото"
                  : "Скачать заключение .docx"}
        </Button>
      </section>
    </div>
  );
}

export default Step5;
