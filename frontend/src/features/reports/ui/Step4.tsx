import { zodResolver } from '@hookform/resolvers/zod';
import { memo } from 'react';
import { type Control, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { COMPLEXITY_OPTIONS, PART_TYPES, REPAIR_PART_NAMES } from '@/constants/reference';
import { type Step4FormData, step4Schema } from '@/schemas/step4.schema';
import { useValidationSync } from '../hooks/useValidationSync';
import { calcRepairWorkPrice } from '../lib/calculations';
import { useFormStore } from '../model/useFormStore';
import { FormStoreSync, IsolatedNumberField, IsolatedTextField } from './fields/isolated-fields';

const EMPTY_STEP4: Step4FormData = {
  hourly_rate: 0,
  repair_works: [],
  paint_works: [],
  spare_parts: [],
  materials: [],
};

/**
 * Cost totals, isolated into a memoized subtree subscribed only to the four
 * collection arrays. Editing a single row's price re-renders this summary but not
 * the other rows or the rest of the step (R1.3).
 */
const Step4Totals = memo(function Step4Totals({ control }: { control: Control<Step4FormData> }) {
  const [repairWorks, paintWorks, spareParts, materials] = useWatch({
    control,
    name: ['repair_works', 'paint_works', 'spare_parts', 'materials'],
  });

  const hasRows =
    (repairWorks?.length ?? 0) +
      (paintWorks?.length ?? 0) +
      (spareParts?.length ?? 0) +
      (materials?.length ?? 0) >
    0;

  if (!hasRows) {
    return null;
  }

  const totalRepair = (repairWorks ?? []).reduce((sum, work) => sum + (work?.price ?? 0), 0);
  const totalPaint = (paintWorks ?? []).reduce(
    (sum, work) => sum + (work?.paint_price ?? 0) + (work?.polish_price ?? 0),
    0,
  );
  const totalSpare = (spareParts ?? []).reduce(
    (sum, part) => sum + (part?.qty ?? 0) * (part?.price ?? 0),
    0,
  );
  const totalMat = (materials ?? []).reduce(
    (sum, mat) => sum + (mat?.qty ?? 0) * (mat?.price ?? 0),
    0,
  );

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
      <div>
        <span className="text-gray-600">Ремонт:</span>{' '}
        <strong>{totalRepair.toLocaleString('ru-RU')}</strong>
      </div>
      <div>
        <span className="text-gray-600">Покраска:</span>{' '}
        <strong>{totalPaint.toLocaleString('ru-RU')}</strong>
      </div>
      <div>
        <span className="text-gray-600">Запчасти:</span>{' '}
        <strong>{totalSpare.toLocaleString('ru-RU')}</strong>
      </div>
      <div>
        <span className="text-gray-600">Материалы:</span>{' '}
        <strong>{totalMat.toLocaleString('ru-RU')}</strong>
      </div>
    </div>
  );
});

function Step4({ onValidationChange }: { onValidationChange: (isValid: boolean) => void }) {
  const step4Data = useFormStore((s) => s.step4);
  const setStep4 = useFormStore((s) => s.setStep4);

  const form = useForm<Step4FormData>({
    resolver: zodResolver(step4Schema),
    mode: 'onChange',
    defaultValues: step4Data ?? EMPTY_STEP4,
  });

  const {
    control,
    setValue,
    getValues,
    formState: { isValid },
  } = form;

  const repairWorks = useFieldArray({ control, name: 'repair_works' });
  const paintWorks = useFieldArray({ control, name: 'paint_works' });
  const spareParts = useFieldArray({ control, name: 'spare_parts' });
  const materials = useFieldArray({ control, name: 'materials' });

  // Sync validation state via formState.isValid subscription
  useValidationSync(isValid, onValidationChange);

  // When the hourly rate changes, recompute every repair work price. `getValues`
  // reads the latest array without subscribing this component to row edits.
  const recalcRepairPrices = (newRate: number) => {
    const currentWorks = getValues('repair_works');
    currentWorks.forEach((work, index) => {
      const newPrice = calcRepairWorkPrice(newRate, work.complexity);
      setValue(`repair_works.${index}.price`, newPrice);
    });
  };

  return (
    <Form {...form}>
      {/* Isolated, debounced Zustand sync — keeps the whole-form watch off this
          component's render path (R1.3). */}
      <FormStoreSync control={control} setter={setStep4} />

      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Шаг 4: Tamirlash</h2>
          <p className="text-sm text-gray-600 mt-2">
            Ремонтные работы, покраска, запчасти и материалы
          </p>
        </div>

        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">
            4.1 — Нормо-час
          </h3>
          <IsolatedNumberField
            name="hourly_rate"
            label="Нормо-час (сум) / Usta haqqi"
            required
            parse="float"
            onValueChange={(value) => recalcRepairPrices(value ?? 0)}
          />
        </section>

        <section>
          <div className="flex justify-between items-center mb-4 pb-2 border-b">
            <h3 className="text-lg font-semibold text-gray-800">4.2 — Ремонтные работы</h3>
            <Button
              type="button"
              onClick={() =>
                repairWorks.append({
                  part_name: '',
                  type: "Bo'luvchi",
                  complexity: 'BT-1',
                  price: calcRepairWorkPrice(getValues('hourly_rate') ?? 0, 'BT-1'),
                })
              }
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
                <IsolatedTextField
                  name={`repair_works.${index}.part_name`}
                  label="Деталь / Detal"
                  list={`repair-parts-${index}`}
                  afterInput={
                    <datalist id={`repair-parts-${index}`}>
                      {REPAIR_PART_NAMES.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  }
                />
                <FormField
                  control={control}
                  name={`repair_works.${index}.type`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>Тип / Turi</FormLabel>
                      <Select onValueChange={f.onChange} value={f.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите тип" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PART_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`repair_works.${index}.complexity`}
                  render={({ field: complexityField }) => (
                    <FormItem>
                      <FormLabel>Сложность / Murakkablik</FormLabel>
                      <Select
                        onValueChange={(val) => {
                          complexityField.onChange(val);
                          const newPrice = calcRepairWorkPrice(getValues('hourly_rate') ?? 0, val);
                          setValue(`repair_works.${index}.price`, newPrice);
                        }}
                        value={complexityField.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите сложность" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COMPLEXITY_OPTIONS.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <IsolatedNumberField
                  name={`repair_works.${index}.price`}
                  label="Стоимость / Narxi"
                  readOnly
                  inputClassName="bg-gray-100"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => repairWorks.remove(index)}
                >
                  Удалить
                </Button>
              </div>
            </div>
          ))}
        </section>

        <section>
          <div className="flex justify-between items-center mb-4 pb-2 border-b">
            <h3 className="text-lg font-semibold text-gray-800">4.3 — Покрасочные работы</h3>
            <Button
              type="button"
              onClick={() => paintWorks.append({ part_name: '', paint_price: 0, polish_price: 0 })}
              size="sm"
            >
              + Добавить
            </Button>
          </div>
          {paintWorks.fields.map((field, index) => (
            <div key={field.id} className="border border-gray-200 rounded-lg p-4 mb-3 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <IsolatedTextField name={`paint_works.${index}.part_name`} label="Деталь / Detal" />
                <IsolatedNumberField
                  name={`paint_works.${index}.paint_price`}
                  label="Покраска / Bo'yoq"
                  parse="float"
                  min={0}
                />
                <IsolatedNumberField
                  name={`paint_works.${index}.polish_price`}
                  label="Полировка / Politura"
                  parse="float"
                  min={0}
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => paintWorks.remove(index)}
                >
                  Удалить
                </Button>
              </div>
            </div>
          ))}
        </section>

        <section>
          <div className="flex justify-between items-center mb-4 pb-2 border-b">
            <h3 className="text-lg font-semibold text-gray-800">
              4.4 — Запчасти / Ehtiyot qismlar
            </h3>
            <Button
              type="button"
              onClick={() => spareParts.append({ name: '', qty: 1, price: 0 })}
              size="sm"
            >
              + Добавить
            </Button>
          </div>
          {spareParts.fields.map((field, index) => (
            <div key={field.id} className="border border-gray-200 rounded-lg p-4 mb-3 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <IsolatedTextField name={`spare_parts.${index}.name`} label="Название / Nom" />
                <IsolatedNumberField
                  name={`spare_parts.${index}.qty`}
                  label="Кол-во / Miqdor"
                  min={1}
                  emptyValue={1}
                />
                <IsolatedNumberField
                  name={`spare_parts.${index}.price`}
                  label="Цена / Narxi"
                  parse="float"
                  min={0}
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => spareParts.remove(index)}
                >
                  Удалить
                </Button>
              </div>
            </div>
          ))}
        </section>

        <section>
          <div className="flex justify-between items-center mb-4 pb-2 border-b">
            <h3 className="text-lg font-semibold text-gray-800">4.5 — Материалы / Materiallar</h3>
            <Button
              type="button"
              onClick={() => materials.append({ name: '', qty: 1, price: 0 })}
              size="sm"
            >
              + Добавить
            </Button>
          </div>
          {materials.fields.map((field, index) => (
            <div key={field.id} className="border border-gray-200 rounded-lg p-4 mb-3 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <IsolatedTextField name={`materials.${index}.name`} label="Название / Nom" />
                <IsolatedNumberField
                  name={`materials.${index}.qty`}
                  label="Кол-во / Miqdor"
                  min={1}
                  emptyValue={1}
                />
                <IsolatedNumberField
                  name={`materials.${index}.price`}
                  label="Цена / Narxi"
                  parse="float"
                  min={0}
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => materials.remove(index)}
                >
                  Удалить
                </Button>
              </div>
            </div>
          ))}
        </section>

        <Step4Totals control={control} />
      </div>
    </Form>
  );
}

export default Step4;
