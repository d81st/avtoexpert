import { useMemo } from 'react';
import { useForm, useWatch, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFormStore } from '../model/useFormStore';
import { useValidationSync } from '../hooks/useValidationSync';
import { useDebouncedStoreSync } from '../hooks/useDebouncedStoreSync';
import {
  COMPLEXITY_OPTIONS,
  PART_TYPES,
  REPAIR_PART_NAMES,
} from '@/constants/reference';
import { calcRepairWorkPrice } from '../lib/calculations';
import { step4Schema, type Step4FormData } from '@/schemas/step4.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

const EMPTY_STEP4: Step4FormData = {
  hourly_rate: 0,
  repair_works: [],
  paint_works: [],
  spare_parts: [],
  materials: [],
};

function Step4({ onValidationChange }: { onValidationChange: (isValid: boolean) => void }) {
  const step4Data = useFormStore((s) => s.step4);
  const setStep4 = useFormStore((s) => s.setStep4);

  const form = useForm<Step4FormData>({
    resolver: zodResolver(step4Schema),
    mode: 'onChange',
    defaultValues: step4Data ?? EMPTY_STEP4,
  });

  const { control, setValue, getValues, formState: { isValid } } = form;

  const repairWorks = useFieldArray({ control, name: 'repair_works' });
  const paintWorks = useFieldArray({ control, name: 'paint_works' });
  const spareParts = useFieldArray({ control, name: 'spare_parts' });
  const materials = useFieldArray({ control, name: 'materials' });

  // Debounced sync to Zustand store (replaces useWatch + useEffect pattern)
  useDebouncedStoreSync(control, setStep4, 300);

  // Granular useWatch calls for UI rendering only
  const hourlyRate = useWatch({ control, name: 'hourly_rate' }) ?? 0;
  const watchedArrays = useWatch({ control, name: ['repair_works', 'paint_works', 'spare_parts', 'materials'] });

  // Sync validation state via formState.isValid subscription
  useValidationSync(isValid, onValidationChange);

  const totals = useMemo(() => {
    const [rw, pw, sp, mt] = watchedArrays;

    return {
      totalRepair: (rw ?? []).reduce((sum, work) => sum + (work?.price ?? 0), 0),
      totalPaint: (pw ?? []).reduce((sum, work) => sum + (work?.paint_price ?? 0) + (work?.polish_price ?? 0), 0),
      totalSpare: (sp ?? []).reduce((sum, part) => sum + ((part?.qty ?? 0) * (part?.price ?? 0)), 0),
      totalMat: (mt ?? []).reduce((sum, mat) => sum + ((mat?.qty ?? 0) * (mat?.price ?? 0)), 0),
    };
  }, [watchedArrays]);

  const recalcRepairPrices = (newRate: number) => {
    const currentWorks = getValues('repair_works');
    currentWorks.forEach((work, index) => {
      const newPrice = calcRepairWorkPrice(newRate, work.complexity);
      setValue(`repair_works.${index}.price`, newPrice);
    });
  };

  return (
    <Form {...form}>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Шаг 4: Tamirlash</h2>
          <p className="text-sm text-gray-600 mt-2">
            Ремонтные работы, покраска, запчасти и материалы
          </p>
        </div>

        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">4.1 — Нормо-час</h3>
          <FormField
            control={control}
            name="hourly_rate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Нормо-час (сум) / Usta haqqi <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={field.value || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      field.onChange(val);
                      recalcRepairPrices(val);
                    }}
                    onBlur={field.onBlur}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <section>
          <div className="flex justify-between items-center mb-4 pb-2 border-b">
            <h3 className="text-lg font-semibold text-gray-800">4.2 — Ремонтные работы</h3>
            <Button
              type="button"
              onClick={() => repairWorks.append({
                part_name: '',
                type: "Bo'luvchi",
                complexity: 'BT-1',
                price: calcRepairWorkPrice(hourlyRate, 'BT-1'),
              })}
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
                <FormField
                  control={control}
                  name={`repair_works.${index}.part_name`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>Деталь / Detal</FormLabel>
                      <FormControl>
                        <div>
                          <Input
                            list={`repair-parts-${index}`}
                            value={f.value}
                            onChange={f.onChange}
                            onBlur={f.onBlur}
                          />
                          <datalist id={`repair-parts-${index}`}>
                            {REPAIR_PART_NAMES.map((name) => (
                              <option key={name} value={name} />
                            ))}
                          </datalist>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`repair_works.${index}.type`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>Тип / Turi</FormLabel>
                      <Select
                        onValueChange={f.onChange}
                        value={f.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите тип" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PART_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
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
                          const newPrice = calcRepairWorkPrice(hourlyRate, val);
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
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`repair_works.${index}.price`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>Стоимость / Narxi</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={f.value}
                          readOnly
                          className="bg-gray-100"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
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
                <FormField
                  control={control}
                  name={`paint_works.${index}.part_name`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>Деталь / Detal</FormLabel>
                      <FormControl>
                        <Input
                          value={f.value}
                          onChange={f.onChange}
                          onBlur={f.onBlur}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`paint_works.${index}.paint_price`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>Покраска / Bo'yoq</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={f.value || ''}
                          onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                          onBlur={f.onBlur}
                          min={0}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`paint_works.${index}.polish_price`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>Полировка / Politura</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={f.value || ''}
                          onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                          onBlur={f.onBlur}
                          min={0}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
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
            <h3 className="text-lg font-semibold text-gray-800">4.4 — Запчасти / Ehtiyot qismlar</h3>
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
                <FormField
                  control={control}
                  name={`spare_parts.${index}.name`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>Название / Nom</FormLabel>
                      <FormControl>
                        <Input
                          value={f.value}
                          onChange={f.onChange}
                          onBlur={f.onBlur}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`spare_parts.${index}.qty`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>Кол-во / Miqdor</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={f.value}
                          onChange={(e) => f.onChange(parseInt(e.target.value) || 1)}
                          onBlur={f.onBlur}
                          min={1}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`spare_parts.${index}.price`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>Цена / Narxi</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={f.value || ''}
                          onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                          onBlur={f.onBlur}
                          min={0}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
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
                <FormField
                  control={control}
                  name={`materials.${index}.name`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>Название / Nom</FormLabel>
                      <FormControl>
                        <Input
                          value={f.value}
                          onChange={f.onChange}
                          onBlur={f.onBlur}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`materials.${index}.qty`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>Кол-во / Miqdor</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={f.value}
                          onChange={(e) => f.onChange(parseInt(e.target.value) || 1)}
                          onBlur={f.onBlur}
                          min={1}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`materials.${index}.price`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>Цена / Narxi</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={f.value || ''}
                          onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                          onBlur={f.onBlur}
                          min={0}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
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

        {(repairWorks.fields.length > 0 || paintWorks.fields.length > 0 || spareParts.fields.length > 0 || materials.fields.length > 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-600">Ремонт:</span> <strong>{totals.totalRepair.toLocaleString('ru-RU')}</strong></div>
            <div><span className="text-gray-600">Покраска:</span> <strong>{totals.totalPaint.toLocaleString('ru-RU')}</strong></div>
            <div><span className="text-gray-600">Запчасти:</span> <strong>{totals.totalSpare.toLocaleString('ru-RU')}</strong></div>
            <div><span className="text-gray-600">Материалы:</span> <strong>{totals.totalMat.toLocaleString('ru-RU')}</strong></div>
          </div>
        )}
      </div>
    </Form>
  );
}

export default Step4;
