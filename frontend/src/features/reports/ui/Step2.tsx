import { useEffect } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { useFormStore } from '../model/useFormStore';
import { useValidationSync } from '../hooks/useValidationSync';
import type { Step2Data } from '../types';
import {
  BODY_TYPES,
  CAR_MODELS,
  TRANSMISSION_TYPES,
  ODOMETER_STATUSES,
  generateYearOptions,
} from '@/constants/reference';
import FieldLabel from '@/shared/ui/FieldLabel';
import Input from '@/shared/ui/Input';
import Select from '@/shared/ui/Select';

interface StepFormProps {
  onValidationChange: (isValid: boolean) => void;
}

function Step2({ onValidationChange }: StepFormProps) {
  const step2Data = useFormStore((s) => s.step2);
  const setStep2 = useFormStore((s) => s.setStep2);

  const { register, control, formState: { isValid, errors, touchedFields } } = useForm<Step2Data>({
    mode: 'onBlur',
    defaultValues: step2Data ?? {
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
    },
  });

  // Sync form data with FormStore via useWatch
  const watchedValues = useWatch({ control });
  useEffect(() => {
    if (watchedValues && Object.keys(watchedValues).length > 0) {
      setStep2(watchedValues as Step2Data);
    }
  }, [watchedValues, setStep2]);

  // Sync validation state via formState.isValid subscription
  useValidationSync(isValid, onValidationChange);

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
              placeholder="Chevrolet Nexia 3"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              {...register('car_model', { required: 'Укажите модель автомобиля' })}
            />
            <datalist id="car-models">
              {CAR_MODELS.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
            {touchedFields.car_model && errors.car_model && (
              <p className="text-red-500 text-sm mt-1">{errors.car_model.message}</p>
            )}
          </div>

          <div>
            <FieldLabel ru="Год выпуска" uz="Ishlab chiqarilgan" required htmlFor="carYear" />
            <select
              id="carYear"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              {...register('car_year', {
                required: 'Выберите год выпуска',
                valueAsNumber: true,
              })}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <Controller
            name="car_color"
            control={control}
            rules={{ required: 'Укажите цвет' }}
            render={({ field, fieldState }) => (
              <Input
                id="carColor"
                label="Цвет / Rangi"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.isTouched && fieldState.error ? fieldState.error.message : undefined}
                required
              />
            )}
          />

          <Controller
            name="body_type"
            control={control}
            rules={{ required: 'Выберите тип кузова' }}
            render={({ field, fieldState }) => (
              <Select
                id="bodyType"
                label="Тип кузова / Kuzov turi"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.isTouched && fieldState.error ? fieldState.error.message : undefined}
                options={[{ value: '', label: 'Выберите...' }, ...BODY_TYPES.map((t) => ({ value: t.value, label: t.label }))]}
                required
              />
            )}
          />

          <Controller
            name="license_plate"
            control={control}
            rules={{ required: 'Укажите госномер' }}
            render={({ field, fieldState }) => (
              <Input
                id="licensePlate"
                label="Госномер / Davlat raqami"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                onBlur={field.onBlur}
                error={fieldState.isTouched && fieldState.error ? fieldState.error.message : undefined}
                placeholder="01A123BC"
                required
              />
            )}
          />
        </div>
      </section>

      {/* Блок 2.2 */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">2.2 — Данные владельца</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Controller
            name="owner_name"
            control={control}
            rules={{ required: 'Укажите Ф.И.О. владельца' }}
            render={({ field, fieldState }) => (
              <Input
                id="ownerName"
                label="Ф.И.О. / F.I.O"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.isTouched && fieldState.error ? fieldState.error.message : undefined}
                required
              />
            )}
          />

          <Controller
            name="tech_passport"
            control={control}
            rules={{ required: 'Укажите номер техпаспорта' }}
            render={({ field, fieldState }) => (
              <Input
                id="techPassport"
                label="Техпаспорт / Texpassport"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.isTouched && fieldState.error ? fieldState.error.message : undefined}
                required
              />
            )}
          />

          <div className="md:col-span-2">
            <Controller
              name="tech_passport_place"
              control={control}
              render={({ field }) => (
                <Input
                  id="techPassportPlace"
                  label="Место выдачи техпаспорта / Berilgan joy"
                  value={field.value || ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="Необязательно"
                />
              )}
            />
          </div>
        </div>
      </section>

      {/* Блок 2.3 */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">2.3 — Технические данные</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Controller
            name="mileage"
            control={control}
            rules={{
              required: 'Укажите показания одометра',
              validate: (v) => (v && v > 0) || 'Укажите показания одометра',
            }}
            render={({ field, fieldState }) => (
              <Input
                type="number"
                id="mileage"
                label="Одометр (км) / Odometr"
                value={field.value || ''}
                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                onBlur={field.onBlur}
                error={fieldState.isTouched && fieldState.error ? fieldState.error.message : undefined}
                min={0}
                required
              />
            )}
          />

          <Controller
            name="odometer_status"
            control={control}
            rules={{ required: 'Выберите статус одометра' }}
            render={({ field }) => (
              <div>
                <FieldLabel ru="Статус одометра" uz="Odometr holati" required />
                <div className="flex gap-4 mt-1">
                  {ODOMETER_STATUSES.map((status) => (
                    <label key={status.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="odometerStatus"
                        value={status.value}
                        checked={field.value === status.value}
                        onChange={() => field.onChange(status.value)}
                        className="text-blue-600"
                      />
                      <span className="text-sm text-gray-700">{status.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          />

          <Controller
            name="mileage_by_method"
            control={control}
            render={({ field }) => (
              <Input
                type="number"
                id="mileageByMethod"
                label="Одометр по методике / Metodika odometr"
                value={field.value || ''}
                onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                onBlur={field.onBlur}
                min={0}
                helper="Расчётный пробег (необязательно)"
              />
            )}
          />

          <div className="md:col-span-2">
            <Controller
              name="vin_code"
              control={control}
              rules={{
                required: 'Укажите VIN-код',
                minLength: { value: 17, message: 'VIN должен содержать 17 символов' },
                maxLength: { value: 17, message: 'VIN должен содержать 17 символов' },
              }}
              render={({ field, fieldState }) => (
                <Input
                  id="vinCode"
                  label="VIN-код / VIN kod"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase().slice(0, 17))}
                  onBlur={field.onBlur}
                  error={fieldState.isTouched && fieldState.error ? fieldState.error.message : undefined}
                  placeholder="WBAAA1305L1234567"
                  maxLength={17}
                  required
                />
              )}
            />
          </div>

          <Controller
            name="engine_number"
            control={control}
            render={({ field }) => (
              <Input
                id="engineNumber"
                label="Номер двигателя / Dvigatel raqami"
                value={field.value || ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Необязательно"
              />
            )}
          />
        </div>
      </section>

      {/* Блок 2.4 */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">2.4 — Внешний осмотр</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Controller
            name="transmission_type"
            control={control}
            rules={{ required: 'Выберите тип трансмиссии' }}
            render={({ field, fieldState }) => (
              <Select
                id="transmissionType"
                label="Тип трансмиссии / Transmissiya turi"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.isTouched && fieldState.error ? fieldState.error.message : undefined}
                options={[{ value: '', label: 'Выберите...' }, ...TRANSMISSION_TYPES.map((t) => ({ value: t.value, label: t.label }))]}
                required
              />
            )}
          />

          <Controller
            name="passport_match"
            control={control}
            render={({ field }) => (
              <div>
                <FieldLabel ru="Сравнение с техпаспортом" uz="Taqqoslash" required />
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="passportMatch"
                      checked={field.value === true}
                      onChange={() => field.onChange(true)}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Совпадает / Mos keladi</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="passportMatch"
                      checked={field.value === false}
                      onChange={() => field.onChange(false)}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Не совпадает / Mos kelmaydi</span>
                  </label>
                </div>
              </div>
            )}
          />

          <Controller
            name="camera_model"
            control={control}
            render={({ field }) => (
              <Input
                id="cameraModel"
                label="Модель камеры / Kamera modeli"
                value={field.value || ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Необязательно"
              />
            )}
          />
        </div>
      </section>
    </div>
  );
}

export default Step2;
