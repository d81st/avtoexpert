export const CAR_MODELS = [
  'Chevrolet Nexia 3',
  'Chevrolet Cobalt',
  'Chevrolet Lacetti',
  'Chevrolet Malibu',
  'Chevrolet Captiva',
  'Chevrolet Equinox',
  'Chevrolet TrailBlazer',
  'Daewoo Matiz',
  'Daewoo Tico',
  'Daewoo Nexia',
  'Hyundai Accent',
  'Hyundai Elantra',
  'Hyundai Tucson',
  'Hyundai Santa Fe',
  'Kia Rio',
  'Kia Cerato',
  'Kia Sportage',
  'Toyota Camry',
  'Toyota Corolla',
  'Toyota Prado',
  'Toyota Hilux',
  'Volkswagen Polo',
  'Volkswagen Jetta',
  'Volkswagen Passat',
] as const;

export const BODY_TYPES = [
  { value: 'Седан', label: 'Седан / Sedan' },
  { value: 'Хэтчбек', label: 'Хэтчбек / Xetchbek' },
  { value: 'Универсал', label: 'Универсал / Universal' },
  { value: 'Внедорожник (SUV)', label: "Внедорожник (SUV) / Yo'l tanlamaydigan" },
  { value: 'Кроссовер', label: 'Кроссовер / Krossover' },
  { value: 'Микроавтобус', label: 'Микроавтобус / Mikroavtobus' },
  { value: 'Пикап', label: 'Пикап / Pikap' },
  { value: 'Купе', label: 'Купе / Kupe' },
  { value: 'Кабриолет', label: 'Кабриолет / Kabriolet' },
] as const;

export const TRANSMISSION_TYPES = [
  { value: 'МКПП', label: 'Механика (МКПП)' },
  { value: 'АКПП', label: 'Автомат (АКПП)' },
  { value: 'Вариатор (CVT)', label: 'Вариатор (CVT)' },
  { value: 'Робот (AMT)', label: 'Робот (AMT)' },
] as const;

export const ODOMETER_STATUSES = [
  { value: 'Исправен', label: 'Исправен / Ishlaydi' },
  { value: 'Неисправен', label: 'Неисправен / Nosoz' },
] as const;

export const PRODUCTION_STATUSES = [
  { value: 'В производстве', label: 'В производстве / Ishlab chiqarilmoqda' },
  { value: 'Снят с производства', label: "Снят с производства / Ishlab chiqarish to'xtatilgan" },
] as const;

export const DEPRECIATION_OPTIONS = [90, 91, 92, 93, 94, 95] as const;

export const REPAIR_PART_NAMES = [
  'Переднее крыло',
  'Заднее крыло',
  'Капот',
  'Бампер передний',
  'Бампер задний',
  'Дверь передняя',
  'Дверь задняя',
  'Крыша',
  'Порог',
  'Крыло переднее',
  'Крыло заднее',
] as const;

export const COMPLEXITY_OPTIONS = [
  { value: 'BT-1', label: 'BT-1 — простая (×1.0)' },
  { value: 'BT-2', label: 'BT-2 — средняя (×1.5)' },
  { value: 'BT-3', label: 'BT-3 — сложная (×2.0)' },
] as const;

export const PART_TYPES = [
  { value: "Bo'luvchi", label: "Съёмная / Bo'luvchi" },
  { value: "Bo'lmaydigan", label: "Несъёмная / Bo'lmaydigan" },
] as const;

export const MAX_PHOTOS = 10;

export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];

export function generateYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let year = currentYear; year >= 1990; year--) {
    years.push(year);
  }
  return years;
}
