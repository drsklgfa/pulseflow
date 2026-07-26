import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';

export function createPrismaClient(databaseUrl = process.env.DATABASE_URL): PrismaClient {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}
