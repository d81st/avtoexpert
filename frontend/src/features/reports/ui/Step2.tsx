import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
import {
  BODY_TYPES,
  CAR_MODELS,
  generateYearOptions,
  ODOMETER_STATUSES,
  TRANSMISSION_TYPES,
} from '@/constants/reference';
import { type Step2FormData, step2Schema } from '@/schemas/step2.schema';
import { useValidationSync } from '../hooks/useValidationSync';
import { useFormStore } from '../model/useFormStore';
import { FormStoreSync, IsolatedNumberField, IsolatedTextField } from './fields/isolated-fields';

interface StepFormProps {
  onValidationChange: (isValid: boolean) => void;
}

function Step2({ onValidationChange }: StepFormProps) {
  const step2Data = useFormStore((s) => s.step2);
  const setStep2 = useFormStore((s) => s.setStep2);

  const form = useForm<Step2FormData>({
    resolver: zodResolver(step2Schema),
    mode: 'onChange',
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

  const {
    control,
    formState: { isValid },
  } = form;

  // Sync validation state via formState.isValid subscription
  useValidationSync(isValid, onValidationChange);

  const yearOptions = generateYearOptions();

  return (
    <Form {...form}>
      {/* Isolated, debounced Zustand sync — keeps the whole-form watch off this
          component's render path (R1.3). */}
      <FormStoreSync control={control} setter={setStep2} />

      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Шаг 2: Identifikatsiya</h2>
          <p className="text-sm text-gray-600 mt-2">Идентификация автомобиля и владельца</p>
        </div>

        {/* Блок 2.1 */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">
            2.1 — Данные автомобиля
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <IsolatedTextField
              name="car_model"
              label="Модель / Avtomobil modeli"
              required
              placeholder="Chevrolet Nexia 3"
              list="car-models"
              afterInput={
                <datalist id="car-models">
                  {CAR_MODELS.map((model) => (
                    <option key={model} value={model} />
                  ))}
                </datalist>
              }
            />

            <FormField
              control={control}
              name="car_year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Год выпуска / Ishlab chiqarilgan <span className="text-red-500">*</span>
                  </FormLabel>
                  <Select
                    onValueChange={(val) => field.onChange(Number(val))}
                    value={String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите год" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <IsolatedTextField name="car_color" label="Цвет / Rangi" required />

            <FormField
              control={control}
              name="body_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Тип кузова / Kuzov turi <span className="text-red-500">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BODY_TYPES.map((t) => (
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

            <IsolatedTextField
              name="license_plate"
              label="Госномер / Davlat raqami"
              required
              placeholder="01A123BC"
              transformValue={(raw) => raw.toUpperCase()}
            />
          </div>
        </section>

        {/* Блок 2.2 */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">
            2.2 — Данные владельца
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <IsolatedTextField name="owner_name" label="Ф.И.О. / F.I.O" required />

            <IsolatedTextField name="tech_passport" label="Техпаспорт / Texpassport" required />

            <IsolatedTextField
              name="tech_passport_place"
              label="Место выдачи техпаспорта / Berilgan joy"
              placeholder="Необязательно"
              className="md:col-span-2"
            />
          </div>
        </section>

        {/* Блок 2.3 */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">
            2.3 — Технические данные
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <IsolatedNumberField name="mileage" label="Одометр (км) / Odometr" required min={0} />

            <FormField
              control={control}
              name="odometer_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Статус одометра / Odometr holati <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="flex gap-4 mt-1">
                      {ODOMETER_STATUSES.map((status) => (
                        <label
                          key={status.value}
                          className="flex items-center gap-2 cursor-pointer"
                        >
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
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <IsolatedNumberField
              name="mileage_by_method"
              label="Одометр по методике / Metodika odometr"
              min={0}
              optional
              description="Расчётный пробег (необязательно)"
            />

            <IsolatedTextField
              name="vin_code"
              label="VIN-код / VIN kod"
              required
              placeholder="WBAAA1305L1234567"
              maxLength={17}
              transformValue={(raw) => raw.toUpperCase().slice(0, 17)}
              className="md:col-span-2"
            />

            <IsolatedTextField
              name="engine_number"
              label="Номер двигателя / Dvigatel raqami"
              placeholder="Необязательно"
            />
          </div>
        </section>

        {/* Блок 2.4 */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">
            2.4 — Внешний осмотр
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={control}
              name="transmission_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Тип трансмиссии / Transmissiya turi <span className="text-red-500">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TRANSMISSION_TYPES.map((t) => (
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
              name="passport_match"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Сравнение с техпаспортом / Taqqoslash <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
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
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <IsolatedTextField
              name="camera_model"
              label="Модель камеры / Kamera modeli"
              placeholder="Необязательно"
            />
          </div>
        </section>
      </div>
    </Form>
  );
}

export default Step2;
