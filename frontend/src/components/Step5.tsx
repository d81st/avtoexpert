import { useCallback, useEffect, useState } from 'react';
import { useFormStore } from '../store/useFormStore';
import { useReportStore } from '../store/useReportStore';
import { reportService } from '../services/reportService';
import type { ReportPhoto } from '../types';
import { ACCEPTED_PHOTO_TYPES, MAX_PHOTOS } from '../constants/reference';
import { calcGrandTotal, formatSum } from '../utils/calculations';
import Alert from './Alert';
import Button from './Button';

interface Step5Props {
  onValidationChange: (isValid: boolean) => void;
  onFinalize: () => Promise<void>;
  isGenerating: boolean;
  generateError: string | null;
  generateSuccess: boolean;
}

function Step5({
  onValidationChange,
  onFinalize,
  isGenerating,
  generateError,
  generateSuccess,
}: Step5Props) {
  const { step3, step4, step5, setStep5 } = useFormStore();
  const { currentReport } = useReportStore();
  const [photos, setPhotos] = useState<ReportPhoto[]>(step5?.photos || []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const loadPhotos = useCallback(async () => {
    if (!currentReport?.id) return;
    try {
      const loaded = await reportService.getPhotos(currentReport.id);
      setPhotos(loaded);
      setStep5({ photos: loaded });
    } catch {
      // Черновик без фото — нормальная ситуация
    }
  }, [currentReport?.id, setStep5]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  useEffect(() => {
    onValidationChange(true);
  }, [onValidationChange]);

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

  const uploadFiles = async (files: FileList | File[]) => {
    if (!currentReport?.id) {
      setUploadError('Сначала сохраните шаг 1, чтобы загрузить фото');
      return;
    }

    const fileArray = Array.from(files);
    const remaining = MAX_PHOTOS - photos.length;

    if (fileArray.length > remaining) {
      setUploadError(`Можно загрузить ещё ${remaining} фото (максимум ${MAX_PHOTOS})`);
      return;
    }

    const invalid = fileArray.filter((f) => !ACCEPTED_PHOTO_TYPES.includes(f.type) && !f.name.match(/\.(jpe?g|png|heic|heif)$/i));
    if (invalid.length > 0) {
      setUploadError('Допустимые форматы: JPG, PNG, HEIC');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const uploaded = await reportService.uploadPhotos(currentReport.id, fileArray);
      const next = [...photos, ...uploaded];
      setPhotos(next);
      setStep5({ photos: next });
    } catch (err) {
      setUploadError((err as Error).message || 'Ошибка загрузки фото');
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      uploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const removePhoto = async (photo: ReportPhoto) => {
    if (!currentReport?.id) return;

    try {
      await reportService.deletePhoto(currentReport.id, photo.id);
      const next = photos.filter((p) => p.id !== photo.id);
      setPhotos(next);
      setStep5({ photos: next });
    } catch (err) {
      setUploadError((err as Error).message || 'Ошибка удаления фото');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Шаг 5: Yakunlash</h2>
        <p className="text-sm text-gray-600 mt-2">Фотографии повреждений и итоговые суммы</p>
      </div>

      {/* 5.1 — Фото */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">5.1 — Фотографии / Rasmlar</h3>

        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
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
            className={`cursor-pointer block ${uploading || photos.length >= MAX_PHOTOS ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="text-4xl mb-3">📸</div>
            <p className="text-gray-700 font-medium">
              {uploading ? 'Загрузка...' : 'Перетащите файлы или нажмите для выбора'}
            </p>
            <p className="text-xs text-gray-500 mt-2">JPG, PNG, HEIC — до {MAX_PHOTOS} фото</p>
            <p className="text-sm font-medium text-blue-600 mt-3">
              Загружено: {photos.length} из {MAX_PHOTOS}
            </p>
          </label>
        </div>

        {uploadError && <Alert type="error" message={uploadError} onClose={() => setUploadError(null)} />}

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
                  onClick={() => removePhoto(photo)}
                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
                <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5.2 — Итоги */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">5.2 — Итоговые суммы / Yakuniy summalar</h3>

        {!step4 ? (
          <Alert type="info" message="Заполните шаг 4 для просмотра итогов" />
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

      {/* 5.3 — Генерация */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">5.3 — Генерация документа</h3>

        {generateError && <Alert type="error" message={generateError} />}

        {generateSuccess && (
          <Alert type="success" message="Документ успешно сгенерирован и скачан!" />
        )}

        <Button
          onClick={onFinalize}
          disabled={isGenerating || !step4}
          variant="success"
          size="lg"
          fullWidth
        >
          {isGenerating ? '⟳ Генерация...' : generateSuccess ? '✓ Готово!' : 'Скачать заключение .docx'}
        </Button>
      </section>
    </div>
  );
}

export default Step5;
