import { useEffect, useMemo } from 'react';
import { useForm, useWatch, useFieldArray, Controller } from 'react-hook-form';
import { useFormStore } from '../model/useFormStore';
import { useValidationSync } from '../hooks/useValidationSync';
import type { Step4Data } from '../types';
import {
  COMPLEXITY_OPTIONS,
  PART_TYPES,
  REPAIR_PART_NAMES,
} from '@/constants/reference';
import { calcRepairWorkPrice } from '../lib/calculations';
import FieldLabel from '@/shared/ui/FieldLabel';
import Input from '@/shared/ui/Input';
import Button from '@/shared/ui/Button';

const EMPTY_STEP4: Step4Data = {
  hourly_rate: 0,
  repair_works: [],
  paint_works: [],
  spare_parts: [],
  materials: [],
};

function Step4({ onValidationChange }: { onValidationChange: (isValid: boolean) => void }) {
  const step4Data = useFormStore((s) => s.step4);
  const setStep4 = useFormStore((s) => s.setStep4);

  const { register, control, formState: { isValid }, setValue, getValues } = useForm<Step4Data>({
    mode: 'onBlur',
    defaultValues: step4Data ?? EMPTY_STEP4,
  });

  const repairWorks = useFieldArray({ control, name: 'repair_works' });
  const paintWorks = useFieldArray({ control, name: 'paint_works' });
  const spareParts = useFieldArray({ control, name: 'spare_parts' });
  const materials = useFieldArray({ control, name: 'materials' });

  const watchedValues = useWatch({ control });

  // Sync form data with FormStore
  useEffect(() => {
    if (watchedValues && Object.keys(watchedValues).length > 0) {
      setStep4(watchedValues as Step4Data);
    }
  }, [watchedValues, setStep4]);

  // Sync validation state via formState.isValid subscription
  useValidationSync(isValid, onValidationChange);

  const hourlyRate = watchedValues.hourly_rate ?? 0;

  const totals = useMemo(() => {
    const rw = watchedValues.repair_works ?? [];
    const pw = watchedValues.paint_works ?? [];
    const sp = watchedValues.spare_parts ?? [];
    const mt = watchedValues.materials ?? [];

    return {
      totalRepair: rw.reduce((sum, work) => sum + (work?.price ?? 0), 0),
      totalPaint: pw.reduce((sum, work) => sum + (work?.paint_price ?? 0) + (work?.polish_price ?? 0), 0),
      totalSpare: sp.reduce((sum, part) => sum + ((part?.qty ?? 0) * (part?.price ?? 0)), 0),
      totalMat: mt.reduce((sum, mat) => sum + ((mat?.qty ?? 0) * (mat?.price ?? 0)), 0),
    };
  }, [watchedValues.repair_works, watchedValues.paint_works, watchedValues.spare_parts, watchedValues.materials]);

  const recalcRepairPrices = (newRate: number) => {
    const currentWorks = getValues('repair_works');
    currentWorks.forEach((work, index) => {
      const newPrice = calcRepairWorkPrice(newRate, work.complexity);
      setValue(`repair_works.${index}.price`, newPrice);
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Шаг 4: Tamirlash</h2>
        <p className="text-sm text-gray-600 mt-2">
          Ремонтные работы, покраска, запчасти и материалы
        </p>
      </div>

      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">4.1 — Нормо-час</h3>
        <Controller
          name="hourly_rate"
          control={control}
          rules={{ required: true, min: 1 }}
          render={({ field, fieldState }) => (
            <Input
              type="number"
              id="hourlyRate"
              label="Нормо-час (сум) / Usta haqqi"
              value={field.value || ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                field.onChange(val);
                recalcRepairPrices(val);
              }}
              onBlur={field.onBlur}
              error={fieldState.error ? 'Нормо-час должен быть больше 0' : undefined}
              required
            />
          )}
        />
      </section>

      <section>
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
          <h3 className="text-lg font-semibold text-gray-800">4.2 — Ремонтные работы</h3>
          <Button
            onClick={() => repairWorks.append({
              part_name: '',
              type: "Bo'luvchi",
              complexity: 'BT-1',
              price: calcRepairWorkPrice(hourlyRate, 'BT-1'),
            })}
            variant="primary"
            size="sm"
          >
            + Добавить
          </Button>
        </div>

        {repairWorks.fields.length === 0 && (
          <p className="text-gray-500 text-sm mb-4">Добавьте минимум одну ремонтную работу</p>
        )}

        {repairWorks.fields.map((field, index) => (
          <div key={field.id} className="border border-gray-200 rounded-lg p-4 mb-3 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div>
                <FieldLabel ru="Деталь" uz="Detal" />
                <input
                  list={`repair-parts-${index}`}
                  {...register(`repair_works.${index}.part_name`)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <datalist id={`repair-parts-${index}`}>
                  {REPAIR_PART_NAMES.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div>
                <FieldLabel ru="Тип" uz="Turi" />
                <select
                  {...register(`repair_works.${index}.type`)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {PART_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel ru="Сложность" uz="Murakkablik" />
                <Controller
                  name={`repair_works.${index}.complexity`}
                  control={control}
                  render={({ field: complexityField }) => (
                    <select
                      value={complexityField.value}
                      onChange={(e) => {
                        complexityField.onChange(e.target.value);
                        const newPrice = calcRepairWorkPrice(hourlyRate, e.target.value);
                        setValue(`repair_works.${index}.price`, newPrice);
                      }}
                      onBlur={complexityField.onBlur}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      {COMPLEXITY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  )}
                />
              </div>
              <div>
                <FieldLabel ru="Стоимость" uz="Narxi" />
                <input
                  type="number"
                  {...register(`repair_works.${index}.price`, { valueAsNumber: true })}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-100"
                />
              </div>
              <button
                type="button"
                onClick={() => repairWorks.remove(index)}
                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded text-sm"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </section>

      <section>
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
          <h3 className="text-lg font-semibold text-gray-800">4.3 — Покрасочные работы</h3>
          <Button
            onClick={() => paintWorks.append({ part_name: '', paint_price: 0, polish_price: 0 })}
            variant="primary"
            size="sm"
          >
            + Добавить
          </Button>
        </div>
        {paintWorks.fields.map((field, index) => (
          <div key={field.id} className="border border-gray-200 rounded-lg p-4 mb-3 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <Controller
                name={`paint_works.${index}.part_name`}
                control={control}
                render={({ field: f }) => (
                  <Input
                    label="Деталь / Detal"
                    value={f.value}
                    onChange={f.onChange}
                    onBlur={f.onBlur}
                  />
                )}
              />
              <Controller
                name={`paint_works.${index}.paint_price`}
                control={control}
                render={({ field: f }) => (
                  <Input
                    type="number"
                    label="Покраска / Bo'yoq"
                    value={f.value || ''}
                    onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                    onBlur={f.onBlur}
                    min={0}
                  />
                )}
              />
              <Controller
                name={`paint_works.${index}.polish_price`}
                control={control}
                render={({ field: f }) => (
                  <Input
                    type="number"
                    label="Полировка / Politura"
                    value={f.value || ''}
                    onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                    onBlur={f.onBlur}
                    min={0}
                  />
                )}
              />
              <button
                type="button"
                onClick={() => paintWorks.remove(index)}
                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded text-sm"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </section>

      <section>
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
          <h3 className="text-lg font-semibold text-gray-800">4.4 — Запчасти / Ehtiyot qismlar</h3>
          <Button
            onClick={() => spareParts.append({ name: '', qty: 1, price: 0 })}
            variant="primary"
            size="sm"
          >
            + Добавить
          </Button>
        </div>
        {spareParts.fields.map((field, index) => (
          <div key={field.id} className="border border-gray-200 rounded-lg p-4 mb-3 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <Controller
                name={`spare_parts.${index}.name`}
                control={control}
                render={({ field: f }) => (
                  <Input
                    label="Название / Nom"
                    value={f.value}
                    onChange={f.onChange}
                    onBlur={f.onBlur}
                  />
                )}
              />
              <Controller
                name={`spare_parts.${index}.qty`}
                control={control}
                render={({ field: f }) => (
                  <Input
                    type="number"
                    label="Кол-во / Miqdor"
                    value={f.value}
                    onChange={(e) => f.onChange(parseInt(e.target.value) || 1)}
                    onBlur={f.onBlur}
                    min={1}
                  />
                )}
              />
              <Controller
                name={`spare_parts.${index}.price`}
                control={control}
                render={({ field: f }) => (
                  <Input
                    type="number"
                    label="Цена / Narxi"
                    value={f.value || ''}
                    onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                    onBlur={f.onBlur}
                    min={0}
                  />
                )}
              />
              <button
                type="button"
                onClick={() => spareParts.remove(index)}
                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded text-sm"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </section>

      <section>
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
          <h3 className="text-lg font-semibold text-gray-800">4.5 — Материалы / Materiallar</h3>
          <Button
            onClick={() => materials.append({ name: '', qty: 1, price: 0 })}
            variant="primary"
            size="sm"
          >
            + Добавить
          </Button>
        </div>
        {materials.fields.map((field, index) => (
          <div key={field.id} className="border border-gray-200 rounded-lg p-4 mb-3 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <Controller
                name={`materials.${index}.name`}
                control={control}
                render={({ field: f }) => (
                  <Input
                    label="Название / Nom"
                    value={f.value}
                    onChange={f.onChange}
                    onBlur={f.onBlur}
                  />
                )}
              />
              <Controller
                name={`materials.${index}.qty`}
                control={control}
                render={({ field: f }) => (
                  <Input
                    type="number"
                    label="Кол-во / Miqdor"
                    value={f.value}
                    onChange={(e) => f.onChange(parseInt(e.target.value) || 1)}
                    onBlur={f.onBlur}
                    min={1}
                  />
                )}
              />
              <Controller
                name={`materials.${index}.price`}
                control={control}
                render={({ field: f }) => (
                  <Input
                    type="number"
                    label="Цена / Narxi"
                    value={f.value || ''}
                    onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                    onBlur={f.onBlur}
                    min={0}
                  />
                )}
              />
              <button
                type="button"
                onClick={() => materials.remove(index)}
                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded text-sm"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </section>

      {(repairWorks.fields.length > 0 || paintWorks.fields.length > 0 || spareParts.fields.length > 0 || materials.fields.length > 0) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-600">Ремонт:</span> <strong>{totals.totalRepair.toLocaleString('ru-RU')}</strong></div>
          <div><span className="text-gray-600">Покраска:</span> <strong>{totals.totalPaint.toLocaleString('ru-RU')}</strong></div>
          <div><span className="text-gray-600">Запчасти:</span> <strong>{totals.totalSpare.toLocaleString('ru-RU')}</strong></div>
          <div><span className="text-gray-600">Материалы:</span> <strong>{totals.totalMat.toLocaleString('ru-RU')}</strong></div>
        </div>
      )}
    </div>
  );
}

export default Step4;
