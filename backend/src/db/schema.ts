import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// NOTE (R8.9): the `photos_report_position_unique` constraint on
// (report_id, position) is declared below as a logical `uniqueIndex` for
// documentation only. The physical constraint is created by hand in migration
// `0002_photo_captions_and_position.sql` as `DEFERRABLE INITIALLY DEFERRED` so
// the reorder transaction (design §3.8) can transiently hold duplicate
// (report_id, position) pairs between its shift and set steps. Drizzle's
// `unique()`/`uniqueIndex()` helpers emit a non-deferrable constraint, so the
// migration — not this declaration — is authoritative for that constraint.

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

  // Optimistic concurrency control for autosave (R2.12)
  version: integer('version').notNull().default(0),

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
export const photos = pgTable(
  'photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reportId: uuid('report_id')
      .references(() => reports.id, { onDelete: 'cascade' })
      .notNull(),
    filePath: varchar('file_path', { length: 500 }),
    // Immutable upload order within a reportId (R4.6). Used for deterministic
    // listing and as the audit/forensic record of the upload sequence.
    sequenceNumber: integer('sequence_number').notNull(),
    originalName: varchar('original_name', { length: 255 }),
    byteSize: integer('byte_size').notNull(),
    mimeType: varchar('mime_type', { length: 64 }).notNull(),
    // User-controlled photo metadata (R8.1, R8.9): nullable caption, ≤200 chars.
    caption: varchar('caption', { length: 200 }),
    // User-controlled display order in the generated .docx (R8.2, R8.9).
    // Independent of sequenceNumber (immutable upload order); mutated by the
    // PATCH … position endpoint (design §3.8).
    position: integer('position').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({
    bySeq: uniqueIndex('photos_report_seq_uniq').on(
      t.reportId,
      t.sequenceNumber,
    ),
    // R8 unique constraint on display-order. Declared here for documentation
    // only; created DEFERRABLE INITIALLY DEFERRED by migration
    // `0002_photo_captions_and_position.sql` (see top-of-file note).
    byPosition: uniqueIndex('photos_report_position_unique').on(
      t.reportId,
      t.position,
    ),
  }),
);

// Неудачные попытки аутентификации (R6.10, R6.12)
export const authFailures = pgTable(
  'auth_failures',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    email: varchar('email', { length: 255 }),
    clientIp: varchar('client_ip', { length: 64 }).notNull(),
    userAgent: varchar('user_agent', { length: 512 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    byIpTime: index('auth_failures_ip_time').on(t.clientIp, t.createdAt),
    byEmailTime: index('auth_failures_email_time').on(t.email, t.createdAt),
  }),
);

