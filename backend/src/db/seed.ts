import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { logger } from '../shared/logger/logger.js';
import { db } from './index';
import { creators, experts } from './schema.js';

async function seed() {
  logger.info('Seeding database...');

  const passwordHash = await bcrypt.hash('secret', 10);
  const [creator] = await db
    .insert(creators)
    .values({
      login: 'taev',
      passwordHash,
      fullName: 'Taev Z.K.',
      role: 'creator',
    })
    .returning();

  logger.info('Created creator', { creatorId: creator.id });

  const [expert1] = await db
    .insert(experts)
    .values([
      {
        creatorId: creator.id,
        fullName: 'Taev Z.K.',
      },
      {
        creatorId: creator.id,
        fullName: 'Ivanov I.I.',
      },
    ])
    .returning();

  logger.info('Created expert', { expertId: expert1.id });
  logger.info('Seeding completed!');
}

seed().catch((error) => {
  logger.error('Seeding failed', error);
  process.exit(1);
});
