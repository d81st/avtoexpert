import {
  bigint,
  boolean,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// Создатели (пользователи системы)
export const creators = pgTable('creators', {
  id: uuid('id').primaryKey().defaultRandom(),
  login: varchar('login', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('creator'), // 'creator' | 'admin'
  createdAt: timestamp('created_at').defaultNow(),
});

// Эксперты (привязаны к создателю)
export const experts = pgTable('experts', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id')
    .references(() => creators.id)
    .notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Заключения
export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id')
    .references(() => creators.id)
    .notNull(),
  expertId: uuid('expert_id')
    .references(() => experts.id)
    .notNull(),
  status: varchar('status', { length: 50 }).notNull().default('draft'), // 'draft' | 'completed'
  currentStep: integer('current_step').notNull().default(1),

  // Шаг 1
  reportNumber: varchar('report_number', { length: 100 }),
  reportDate: timestamp('report_date'),
  applicationDate: timestamp('application_date'),

  // Шаг 2
  carModel: varchar('car_model', { length: 255 }),
  carYear: integer('car_year'),
  carColor: varchar('car_color', { length: 100 }),
  bodyType: varchar('body_type', { length: 100 }),
  licensePlate: varchar('license_plate', { length: 50 }),
  ownerName: varchar('owner_name', { length: 255 }),
  techPassport: varchar('tech_passport', { length: 255 }),
  techPassportPlace: varchar('tech_passport_place', { length: 255 }),
  mileage: integer('mileage'),
  odometerStatus: varchar('odometer_status', { length: 50 }),
  mileageByMethod: integer('mileage_by_method'),
  vinCode: varchar('vin_code', { length: 17 }),
  engineNumber: varchar('engine_number', { length: 255 }),
  transmissionType: varchar('transmission_type', { length: 100 }),
  cameraModel: varchar('camera_model', { length: 255 }),
  passportMatch: boolean('passport_match'),

  // Шаг 3
  productionStatus: varchar('production_status', { length: 50 }),
  analog1Mileage: integer('analog1_mileage'),
  analog1Price: bigint('analog1_price', { mode: 'number' }),
  analog2Mileage: integer('analog2_mileage'),
  analog2Price: bigint('analog2_price', { mode: 'number' }),
  analog3Mileage: integer('analog3_mileage'),
  analog3Price: bigint('analog3_price', { mode: 'number' }),
  factoryPrice: bigint('factory_price', { mode: 'number' }),
  depreciationPct: integer('depreciation_pct'),

  // Шаг 4
  hourlyRate: integer('hourly_rate'),

  // Шаг 5 (метаданные)
  grandTotal: bigint('grand_total', { mode: 'number' }),

  updatedAt: timestamp('updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Ремонтные работы
export const repairWorks = pgTable('repair_works', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id')
    .references(() => reports.id, { onDelete: 'cascade' })
    .notNull(),
  partName: varchar('part_name', { length: 255 }),
  partType: varchar('part_type', { length: 50 }), // 'Bo\'luvchi' | 'Bo\'lmaydigan'
  complexity: varchar('complexity', { length: 50 }), // 'BT-1' | 'BT-2' | 'BT-3'
  price: bigint('price', { mode: 'number' }),
});

// Покрасочные работы
export const paintWorks = pgTable('paint_works', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id')
    .references(() => reports.id, { onDelete: 'cascade' })
    .notNull(),
  partName: varchar('part_name', { length: 255 }),
  paintPrice: bigint('paint_price', { mode: 'number' }),
  polishPrice: bigint('polish_price', { mode: 'number' }),
});

// Запчасти
export const spareParts = pgTable('spare_parts', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id')
    .references(() => reports.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }),
  qty: integer('qty'),
  price: bigint('price', { mode: 'number' }),
});

// Материалы
export const materials = pgTable('materials', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id')
    .references(() => reports.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }),
  qty: integer('qty'),
  price: bigint('price', { mode: 'number' }),
});

// Фотографии
export const photos = pgTable('photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id')
    .references(() => reports.id, { onDelete: 'cascade' })
    .notNull(),
  filePath: varchar('file_path', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow(),
});
