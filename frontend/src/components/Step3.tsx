import { useEffect, useState } from 'react';
import { useFormStore } from '../store/useFormStore';
import type { Step3Data } from '../types';
import { DEPRECIATION_OPTIONS, PRODUCTION_STATUSES } from '../constants/reference';
import {
  calcAverageAnalogPrice,
  calcMarketPrice,
  formatSum,
} from '../utils/calculations';
import FieldLabel from './FieldLabel';
import Input from './Input';

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
  const { step3, setStep3 } = useFormStore();
  const [data, setData] = useState<Step3Data>(step3 || EMPTY_STEP3);

  useEffect(() => {
    if (step3) setData(step3);
  }, [step3]);

  useEffect(() => {
    const isValid =
      !!data.production_status &&
      data.analog1_mileage > 0 &&
      data.analog1_price > 0 &&
      data.analog2_mileage > 0 &&
      data.analog2_price > 0 &&
      data.analog3_mileage > 0 &&
      data.analog3_price > 0 &&
      DEPRECIATION_OPTIONS.includes(data.depreciation_pct as typeof DEPRECIATION_OPTIONS[number]);

    onValidationChange(isValid);
  }, [data, onValidationChange]);

  const update = (patch: Partial<Step3Data>) => {
    const next = { ...data, ...patch };
    setData(next);
    setStep3(next);
  };

  const averagePrice = calcAverageAnalogPrice([
    data.analog1_price,
    data.analog2_price,
    data.analog3_price,
  ]);
  const marketPrice = averagePrice !== null ? calcMarketPrice(averagePrice, data.depreciation_pct) : null;

  const renderAnalog = (index: 1 | 2 | 3) => {
    const mileageKey = `analog${index}_mileage` as keyof Step3Data;
    const priceKey = `analog${index}_price` as keyof Step3Data;

    return (
      <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h4 className="font-medium text-gray-800 mb-3">Аналог {index} / Analog {index}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            type="number"
            label="Пробег (км)"
            value={data[mileageKey] as number || ''}
            onChange={(e) => update({ [mileageKey]: parseInt(e.target.value) || 0 })}
            min={0}
            required
          />
          <Input
            type="number"
            label="Цена (сум)"
            value={data[priceKey] as number || ''}
            onChange={(e) => update({ [priceKey]: parseInt(e.target.value) || 0 })}
            min={0}
            required
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
                name="productionStatus"
                value={status.value}
                checked={data.production_status === status.value}
                onChange={() => update({ production_status: status.value as Step3Data['production_status'] })}
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
        <Input
          type="number"
          id="factoryPrice"
          label="Цена нового (с завода)"
          value={data.factory_price || ''}
          onChange={(e) => update({ factory_price: parseInt(e.target.value) || undefined })}
          min={0}
          helper="Необязательно"
        />

        <div>
          <FieldLabel ru="% физического износа" uz="Jismoniy eskirish %" required htmlFor="depreciationPct" />
          <select
            id="depreciationPct"
            value={data.depreciation_pct}
            onChange={(e) => update({ depreciation_pct: parseInt(e.target.value) })}
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
