import { zodResolver } from '@hookform/resolvers/zod';
import { memo } from 'react';
import { type Control, useForm, useWatch } from 'react-hook-form';
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
import { DEPRECIATION_OPTIONS, PRODUCTION_STATUSES } from '@/constants/reference';
import { type Step3FormData, step3Schema } from '@/schemas/step3.schema';
import { formatSum } from '@/shared/lib/formatters';
import { useValidationSync } from '../hooks/useValidationSync';
import { calcAverageAnalogPrice, calcMarketPrice } from '../lib/calculations';
import { useFormStore } from '../model/useFormStore';
import { FormStoreSync, IsolatedNumberField } from './fields/isolated-fields';

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

/**
 * Auto-calculation summary, isolated into its own memoized subtree.
 *
 * It subscribes only to the analog prices and the depreciation percentage through
 * a scoped `useWatch`, so it re-renders when those change without forcing the rest
 * of the step (or the input fields) to re-render (R1.3).
 */
const Step3Summary = memo(function Step3Summary({ control }: { control: Control<Step3FormData> }) {
  const [price1, price2, price3, depreciation] = useWatch({
    control,
    name: ['analog1_price', 'analog2_price', 'analog3_price', 'depreciation_pct'],
  });

  const averagePrice = calcAverageAnalogPrice([price1 ?? 0, price2 ?? 0, price3 ?? 0]);
  const depreciationValue = depreciation ?? 90;
  const marketPrice =
    averagePrice !== null ? calcMarketPrice(averagePrice, depreciationValue) : null;

  return (
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
  );
});

function renderAnalog(index: 1 | 2 | 3) {
  return (
    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <h4 className="font-medium text-gray-800 mb-3">
        Аналог {index} / Analog {index}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <IsolatedNumberField name={`analog${index}_mileage`} label="Пробег (км)" min={0} />
        <IsolatedNumberField name={`analog${index}_price`} label="Цена (сум)" min={0} />
      </div>
    </div>
  );
}

function Step3({ onValidationChange }: { onValidationChange: (isValid: boolean) => void }) {
  const step3Data = useFormStore((s) => s.step3);
  const setStep3 = useFormStore((s) => s.setStep3);

  const form = useForm<Step3FormData>({
    resolver: zodResolver(step3Schema),
    mode: 'onChange',
    defaultValues: step3Data ?? EMPTY_STEP3,
  });

  const {
    control,
    formState: { isValid },
  } = form;

  // Sync validation state via formState.isValid subscription
  useValidationSync(isValid, onValidationChange);

  return (
    <Form {...form}>
      {/* Isolated, debounced Zustand sync — keeps the whole-form watch off this
          component's render path (R1.3). */}
      <FormStoreSync control={control} setter={setStep3} />

      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Шаг 3: Bozor bahosi</h2>
          <p className="text-sm text-gray-600 mt-2">
            Определение рыночной стоимости автомобиля до аварии
          </p>
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
          <IsolatedNumberField
            name="factory_price"
            label="Цена нового (с завода)"
            min={0}
            optional
            description="Необязательно"
          />

          <FormField
            control={control}
            name="depreciation_pct"
            render={({ field }) => (
              <FormItem>
                <FormLabel>% физического износа / Jismoniy eskirish %</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(Number(val))}
                  value={String(field.value ?? 90)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите %" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DEPRECIATION_OPTIONS.map((pct) => (
                      <SelectItem key={pct} value={String(pct)}>
                        {pct}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <Step3Summary control={control} />
      </div>
    </Form>
  );
}

export default Step3;
