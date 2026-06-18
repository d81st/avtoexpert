import { useEffect, useState } from 'react';
import { useFormStore } from '../store/useFormStore';
import type { Step2Data } from '../types';
import {
  BODY_TYPES,
  CAR_MODELS,
  TRANSMISSION_TYPES,
  ODOMETER_STATUSES,
  generateYearOptions,
} from '../constants/reference';
import FieldLabel from './FieldLabel';
import Input from './Input';
import Select from './Select';

const EMPTY_STEP2: Step2Data = {
  car_model: '',
  car_year: new Date().getFullYear(),
  car_color: '',
  body_type: '',
  license_plate: '',
  owner_name: '',
  tech_passport: '',
  tech_passport_place: '',
  mileage: 0,
  odometer_status: 'Исправен',
  mileage_by_method: undefined,
  vin_code: '',
  engine_number: '',
  transmission_type: '',
  camera_model: '',
  passport_match: true,
};

function Step2({ onValidationChange }: { onValidationChange: (isValid: boolean) => void }) {
  const { step2, setStep2 } = useFormStore();
  const [data, setData] = useState<Step2Data>(step2 || EMPTY_STEP2);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (step2) setData(step2);
  }, [step2]);

  useEffect(() => {
    const isValid =
      !!data.car_model &&
      !!data.car_year &&
      !!data.car_color &&
      !!data.body_type &&
      !!data.license_plate &&
      !!data.owner_name &&
      !!data.tech_passport &&
      data.mileage > 0 &&
      !!data.vin_code &&
      data.vin_code.length === 17 &&
      !!data.odometer_status &&
      !!data.transmission_type;

    onValidationChange(isValid);
  }, [data, onValidationChange]);

  const update = (patch: Partial<Step2Data>) => {
    const next = { ...data, ...patch };
    setData(next);
    setStep2(next);
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const getError = (field: keyof Step2Data, message: string) => {
    return touched[field] ? message : undefined;
  };

  const yearOptions = generateYearOptions();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Шаг 2: Identifikatsiya</h2>
        <p className="text-sm text-gray-600 mt-2">Идентификация автомобиля и владельца</p>
      </div>

      {/* Блок 2.1 */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">2.1 — Данные автомобиля</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <FieldLabel ru="Модель" uz="Avtomobil modeli" required htmlFor="carModel" />
            <input
              id="carModel"
              list="car-models"
              value={data.car_model}
              onChange={(e) => update({ car_model: e.target.value })}
              onBlur={() => handleBlur('car_model')}
              placeholder="Chevrolet Nexia 3"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <datalist id="car-models">
              {CAR_MODELS.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
            {getError('car_model', 'Укажите модель автомобиля') && (
              <p className="text-red-500 text-sm mt-1">{getError('car_model', 'Укажите модель автомобиля')}</p>
            )}
          </div>

          <div>
            <FieldLabel ru="Год выпуска" uz="Ishlab chiqarilgan" required htmlFor="carYear" />
            <select
              id="carYear"
              value={data.car_year}
              onChange={(e) => update({ car_year: parseInt(e.target.value) })}
              onBlur={() => handleBlur('car_year')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <Input
            id="carColor"
            label="Цвет / Rangi"
            value={data.car_color}
            onChange={(e) => update({ car_color: e.target.value })}
            onBlur={() => handleBlur('car_color')}
            error={getError('car_color', 'Укажите цвет')}
            required
          />

          <Select
            id="bodyType"
            label="Тип кузова / Kuzov turi"
            value={data.body_type}
            onChange={(e) => update({ body_type: e.target.value })}
            onBlur={() => handleBlur('body_type')}
            error={getError('body_type', 'Выберите тип кузова')}
            options={[{ value: '', label: 'Выберите...' }, ...BODY_TYPES.map((t) => ({ value: t.value, label: t.label }))]}
            required
          />

          <Input
            id="licensePlate"
            label="Госномер / Davlat raqami"
            value={data.license_plate}
            onChange={(e) => update({ license_plate: e.target.value.toUpperCase() })}
            onBlur={() => handleBlur('license_plate')}
            error={getError('license_plate', 'Укажите госномер')}
            placeholder="01A123BC"
            required
          />
        </div>
      </section>

      {/* Блок 2.2 */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">2.2 — Данные владельца</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            id="ownerName"
            label="Ф.И.О. / F.I.O"
            value={data.owner_name}
            onChange={(e) => update({ owner_name: e.target.value })}
            onBlur={() => handleBlur('owner_name')}
            error={getError('owner_name', 'Укажите Ф.И.О. владельца')}
            required
          />

          <Input
            id="techPassport"
            label="Техпаспорт / Texpassport"
            value={data.tech_passport}
            onChange={(e) => update({ tech_passport: e.target.value })}
            onBlur={() => handleBlur('tech_passport')}
            error={getError('tech_passport', 'Укажите номер техпаспорта')}
            required
          />

          <div className="md:col-span-2">
            <Input
              id="techPassportPlace"
              label="Место выдачи техпаспорта / Berilgan joy"
              value={data.tech_passport_place || ''}
              onChange={(e) => update({ tech_passport_place: e.target.value })}
              placeholder="Необязательно"
            />
          </div>
        </div>
      </section>

      {/* Блок 2.3 */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">2.3 — Технические данные</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            type="number"
            id="mileage"
            label="Одометр (км) / Odometr"
            value={data.mileage || ''}
            onChange={(e) => update({ mileage: parseInt(e.target.value) || 0 })}
            onBlur={() => handleBlur('mileage')}
            error={getError('mileage', 'Укажите показания одометра')}
            min={0}
            required
          />

          <div>
            <FieldLabel ru="Статус одометра" uz="Odometr holati" required />
            <div className="flex gap-4 mt-1">
              {ODOMETER_STATUSES.map((status) => (
                <label key={status.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="odometerStatus"
                    value={status.value}
                    checked={data.odometer_status === status.value}
                    onChange={() => update({ odometer_status: status.value as Step2Data['odometer_status'] })}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">{status.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Input
            type="number"
            id="mileageByMethod"
            label="Одометр по методике / Metodika odometr"
            value={data.mileage_by_method || ''}
            onChange={(e) => update({ mileage_by_method: parseInt(e.target.value) || undefined })}
            min={0}
            helper="Расчётный пробег (необязательно)"
          />

          <div className="md:col-span-2">
            <Input
              id="vinCode"
              label="VIN-код / VIN kod"
              value={data.vin_code}
              onChange={(e) => update({ vin_code: e.target.value.toUpperCase().slice(0, 17) })}
              onBlur={() => handleBlur('vin_code')}
              error={
                touched.vin_code && data.vin_code.length !== 17
                  ? 'VIN должен содержать 17 символов'
                  : getError('vin_code', 'Укажите VIN-код')
              }
              placeholder="WBAAA1305L1234567"
              maxLength={17}
              required
            />
          </div>

          <Input
            id="engineNumber"
            label="Номер двигателя / Dvigatel raqami"
            value={data.engine_number || ''}
            onChange={(e) => update({ engine_number: e.target.value })}
            placeholder="Необязательно"
          />
        </div>
      </section>

      {/* Блок 2.4 */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">2.4 — Внешний осмотр</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Select
            id="transmissionType"
            label="Тип трансмиссии / Transmissiya turi"
            value={data.transmission_type}
            onChange={(e) => update({ transmission_type: e.target.value })}
            onBlur={() => handleBlur('transmission_type')}
            error={getError('transmission_type', 'Выберите тип трансмиссии')}
            options={[{ value: '', label: 'Выберите...' }, ...TRANSMISSION_TYPES.map((t) => ({ value: t.value, label: t.label }))]}
            required
          />

          <div>
            <FieldLabel ru="Сравнение с техпаспортом" uz="Taqqoslash" required />
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="passportMatch"
                  checked={data.passport_match === true}
                  onChange={() => update({ passport_match: true })}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">Совпадает / Mos keladi</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="passportMatch"
                  checked={data.passport_match === false}
                  onChange={() => update({ passport_match: false })}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">Не совпадает / Mos kelmaydi</span>
              </label>
            </div>
          </div>

          <Input
            id="cameraModel"
            label="Модель камеры / Kamera modeli"
            value={data.camera_model || ''}
            onChange={(e) => update({ camera_model: e.target.value })}
            placeholder="Необязательно"
          />
        </div>
      </section>
    </div>
  );
}

export default Step2;
