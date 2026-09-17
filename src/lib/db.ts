import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../generated/prisma/client';

const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalDb.prisma ?? new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
if (process.env.NODE_ENV !== 'production') globalDb.prisma = prisma;

export { Prisma };
export type Database = Prisma.TransactionClient;
export function transaction<T>(fn: (db: Database) => Promise<T>, isolationLevel: Prisma.TransactionIsolationLevel = 'ReadCommitted') {
  return prisma.$transaction(fn, { isolationLevel, maxWait: 10000, timeout: 15000 });
}
export const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
export const dateValue = (date: string) => new Date(`${date}T00:00:00.000Z`);
export async function businessDay(db: Database, timezone: string) {
  const [result] = await db.$queryRaw<{ today: string }[]>`SELECT to_char(clock_timestamp() AT TIME ZONE ${timezone},'YYYY-MM-DD') AS today`;
  return result.today;
}
