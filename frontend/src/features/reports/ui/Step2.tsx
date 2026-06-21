import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFormStore } from '../model/useFormStore';
import { useValidationSync } from '../hooks/useValidationSync';
import type { Step2Data } from '../types';
import { step2Schema, type Step2FormData } from '@/schemas/step2.schema';
import {
  BODY_TYPES,
  CAR_MODELS,
  TRANSMISSION_TYPES,
  ODOMETER_STATUSES,
  generateYearOptions,
} from '@/constants/reference';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

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

  const { control, formState: { isValid } } = form;

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
    <Form {...form}>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Шаг 2: Identifikatsiya</h2>
          <p className="text-sm text-gray-600 mt-2">Идентификация автомобиля и владельца</p>
        </div>

        {/* Блок 2.1 */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">2.1 — Данные автомобиля</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={control}
              name="car_model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Модель / Avtomobil modeli <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <div>
                      <Input
                        list="car-models"
                        placeholder="Chevrolet Nexia 3"
                        {...field}
                      />
                      <datalist id="car-models">
                        {CAR_MODELS.map((model) => (
                          <option key={model} value={model} />
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
              name="car_year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Год выпуска / Ishlab chiqarilgan <span className="text-red-500">*</span></FormLabel>
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
                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="car_color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Цвет / Rangi <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="body_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип кузова / Kuzov turi <span className="text-red-500">*</span></FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BODY_TYPES.map((t) => (
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
              name="license_plate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Госномер / Davlat raqami <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input
                      placeholder="01A123BC"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* Блок 2.2 */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">2.2 — Данные владельца</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={control}
              name="owner_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ф.И.О. / F.I.O <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="tech_passport"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Техпаспорт / Texpassport <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="md:col-span-2">
              <FormField
                control={control}
                name="tech_passport_place"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Место выдачи техпаспорта / Berilgan joy</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Необязательно"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </section>

        {/* Блок 2.3 */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">2.3 — Технические данные</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={control}
              name="mileage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Одометр (км) / Odometr <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="odometer_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Статус одометра / Odometr holati <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
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
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="mileage_by_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Одометр по методике / Metodika odometr</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                    />
                  </FormControl>
                  <FormDescription>Расчётный пробег (необязательно)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="md:col-span-2">
              <FormField
                control={control}
                name="vin_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VIN-код / VIN kod <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="WBAAA1305L1234567"
                        maxLength={17}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase().slice(0, 17))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={control}
              name="engine_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Номер двигателя / Dvigatel raqami</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Необязательно"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* Блок 2.4 */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">2.4 — Внешний осмотр</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={control}
              name="transmission_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип трансмиссии / Transmissiya turi <span className="text-red-500">*</span></FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TRANSMISSION_TYPES.map((t) => (
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
              name="passport_match"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Сравнение с техпаспортом / Taqqoslash <span className="text-red-500">*</span></FormLabel>
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

            <FormField
              control={control}
              name="camera_model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Модель камеры / Kamera modeli</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Необязательно"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>
      </div>
    </Form>
  );
}

export default Step2;
