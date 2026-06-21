import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFormStore } from '../model/useFormStore';
import { useValidationSync } from '../hooks/useValidationSync';
import type { Step3Data } from '../types';
import { step3Schema, type Step3FormData } from '@/schemas/step3.schema';
import { DEPRECIATION_OPTIONS, PRODUCTION_STATUSES } from '@/constants/reference';
import {
  calcAverageAnalogPrice,
  calcMarketPrice,
} from '../lib/calculations';
import { formatSum } from '@/shared/lib/formatters';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

const EMPTY_STEP3: Step3FormData = {
  production_status: 'В производстве',
  analog1_mileage: 0,
  analog1_price: 0,
  analog2_mileage: 0,
  analog2_price: 0,
  analog3_mileage: 0,
  analog3_price: 0,
  factory_price: undefined,
  depreciation_pct: 90,
};

function Step3({ onValidationChange }: { onValidationChange: (isValid: boolean) => void }) {
  const step3Data = useFormStore((s) => s.step3);
  const setStep3 = useFormStore((s) => s.setStep3);

  const form = useForm<Step3FormData>({
    resolver: zodResolver(step3Schema),
    mode: 'onChange',
    defaultValues: step3Data ?? EMPTY_STEP3,
  });

  const { control, formState: { isValid } } = form;

  const watchedValues = useWatch({ control });

  // Sync form data with FormStore
  useEffect(() => {
    if (watchedValues && Object.keys(watchedValues).length > 0) {
      setStep3(watchedValues as Step3Data);
    }
  }, [watchedValues, setStep3]);

  // Sync validation state via formState.isValid subscription
  useValidationSync(isValid, onValidationChange);

  const averagePrice = calcAverageAnalogPrice([
    watchedValues.analog1_price ?? 0,
    watchedValues.analog2_price ?? 0,
    watchedValues.analog3_price ?? 0,
  ]);
  const marketPrice = averagePrice !== null
    ? calcMarketPrice(averagePrice, watchedValues.depreciation_pct ?? 90)
    : null;

  const renderAnalog = (index: 1 | 2 | 3) => {
    const mileageKey = `analog${index}_mileage` as const;
    const priceKey = `analog${index}_price` as const;

    return (
      <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h4 className="font-medium text-gray-800 mb-3">Аналог {index} / Analog {index}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name={mileageKey}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Пробег (км)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    onBlur={field.onBlur}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={priceKey}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Цена (сум)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    onBlur={field.onBlur}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    );
  };

  return (
    <Form {...form}>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Шаг 3: Bozor bahosi</h2>
          <p className="text-sm text-gray-600 mt-2">Определение рыночной стоимости автомобиля до аварии</p>
        </div>

        <section>
          <FormField
            control={control}
            name="production_status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Статус производства / Ishlab chiqarish holati</FormLabel>
                <FormControl>
                  <div className="flex flex-wrap gap-4 mt-2">
                    {PRODUCTION_STATUSES.map((status) => (
                      <label key={status.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value={status.value}
                          checked={field.value === status.value}
                          onChange={() => field.onChange(status.value)}
                          className="text-blue-600"
                        />
                        <span className="text-sm text-gray-700">{status.label}</span>
                      </label>
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Аналоги / Analoglar</h3>
          {renderAnalog(1)}
          {renderAnalog(2)}
          {renderAnalog(3)}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={control}
            name="factory_price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Цена нового (с завода)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                    onBlur={field.onBlur}
                  />
                </FormControl>
                <FormDescription>Необязательно</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="depreciation_pct"
            render={({ field }) => (
              <FormItem>
                <FormLabel>% физического износа / Jismoniy eskirish %</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(Number(val))}
                  value={String(field.value)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите %" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DEPRECIATION_OPTIONS.map((pct) => (
                      <SelectItem key={pct} value={String(pct)}>{pct}%</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <section className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-4">Авто-расчёт / Avtomatik hisob</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center bg-white/70 p-3 rounded">
              <span className="text-gray-700">Средняя цена аналогов / O'rtacha narx</span>
              <span className="font-bold text-blue-700">{formatSum(averagePrice)}</span>
            </div>
            <div className="flex justify-between items-center bg-white/70 p-3 rounded">
              <span className="text-gray-700">Рыночная стоимость / Bozor qiymati</span>
              <span className="font-bold text-2xl text-blue-700">{formatSum(marketPrice)}</span>
            </div>
          </div>
        </section>
      </div>
    </Form>
  );
}

export default Step3;
