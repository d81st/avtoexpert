import { useEffect } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { useFormStore } from '../model/useFormStore';
import { useValidationSync } from '../hooks/useValidationSync';
import type { Step3Data } from '../types';
import { DEPRECIATION_OPTIONS, PRODUCTION_STATUSES } from '@/constants/reference';
import {
  calcAverageAnalogPrice,
  calcMarketPrice,
} from '../lib/calculations';
import { formatSum } from '@/shared/lib/formatters';
import FieldLabel from '@/shared/ui/FieldLabel';
import Input from '@/shared/ui/Input';

const EMPTY_STEP3: Step3Data = {
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

  const { register, control, formState: { isValid } } = useForm<Step3Data>({
    mode: 'onBlur',
    defaultValues: step3Data ?? EMPTY_STEP3,
  });

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
          <Controller
            name={mileageKey}
            control={control}
            rules={{ required: true, min: 0 }}
            render={({ field }) => (
              <Input
                type="number"
                label="Пробег (км)"
                value={field.value || ''}
                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                onBlur={field.onBlur}
                min={0}
                required
              />
            )}
          />
          <Controller
            name={priceKey}
            control={control}
            rules={{ required: true, min: 0 }}
            render={({ field }) => (
              <Input
                type="number"
                label="Цена (сум)"
                value={field.value || ''}
                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                onBlur={field.onBlur}
                min={0}
                required
              />
            )}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Шаг 3: Bozor bahosi</h2>
        <p className="text-sm text-gray-600 mt-2">Определение рыночной стоимости автомобиля до аварии</p>
      </div>

      <section>
        <FieldLabel ru="Статус производства" uz="Ishlab chiqarish holati" required />
        <div className="flex flex-wrap gap-4 mt-2">
          {PRODUCTION_STATUSES.map((status) => (
            <label key={status.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value={status.value}
                {...register('production_status', { required: true })}
                className="text-blue-600"
              />
              <span className="text-sm text-gray-700">{status.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Аналоги / Analoglar</h3>
        {renderAnalog(1)}
        {renderAnalog(2)}
        {renderAnalog(3)}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Controller
          name="factory_price"
          control={control}
          render={({ field }) => (
            <Input
              type="number"
              id="factoryPrice"
              label="Цена нового (с завода)"
              value={field.value || ''}
              onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
              onBlur={field.onBlur}
              min={0}
              helper="Необязательно"
            />
          )}
        />

        <div>
          <FieldLabel ru="% физического износа" uz="Jismoniy eskirish %" required htmlFor="depreciationPct" />
          <select
            id="depreciationPct"
            {...register('depreciation_pct', { required: true, valueAsNumber: true })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DEPRECIATION_OPTIONS.map((pct) => (
              <option key={pct} value={pct}>{pct}%</option>
            ))}
          </select>
        </div>
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
  );
}

export default Step3;
