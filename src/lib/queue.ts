import { z } from 'zod';
import { transaction, businessDay, dateValue, Prisma, type Database } from './db';
import { AppError, validCpf } from './domain';
const uuid = z.string().uuid();
export const issueSchema = z.object({
  action: z.literal('issue'),
  requestId: uuid,
  unitId: uuid,
  personId: uuid.optional(),
  name: z.string().trim().min(2).max(200),
  birthDate: z.iso.date(),
  cpf: z
    .string()
    .transform((v) => v.replace(/[.\-\s]/g, ''))
    .refine((v) => !v || validCpf(v), 'CPF inválido.'),
  service: z.enum(['FAM', 'CRI', 'TRI', 'IDE']),
});
export const callSchema = z.object({
  action: z.enum(['next', 'recall']),
  requestId: uuid,
  unitId: uuid,
  deskId: uuid,
});
export async function authorizeUnit(
  db: Database,
  userId: string,
  unitId: string,
  lock = false,
) {
  // Prisma has no row-lock API: keep parameterized SQL only for locking.
  if (lock) await db.$queryRaw`SELECT id FROM units WHERE id=${unitId}::uuid FOR UPDATE`;
  const unit = await db.unit.findFirst({ where: { id: unitId, active: true, memberships: { some: { user_id: userId } } } });
  if (!unit)
    throw new AppError('Unidade indisponível ou acesso não autorizado.', 403);
  // Compute the business day after acquiring the unit lock, including across midnight.
  return { ...unit, today: await businessDay(db, unit.timezone) };
}
async function idempotent(
  db: Database,
  userId: string,
  data: { requestId: string },
  fn: () => Promise<unknown>,
) {
  // Cast void to text so the adapter can deserialize PostgreSQL's lock result.
  await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${userId}:${data.requestId}`},0))::text`;
  const payload = JSON.stringify(data);
  const previous = await db.operation.findUnique({ where: { user_id_request_id: { user_id: userId, request_id: data.requestId } } });
  if (previous) {
    if (previous.payload !== payload)
      throw new AppError('Identificador já utilizado por outra operação.', 409);
    return previous.result;
  }
  const result = await fn();
  await db.operation.create({ data: { user_id: userId, request_id: data.requestId, payload, result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue } });
  return result;
}
export async function issueTicket(userId: string, input: unknown) {
  const data = issueSchema.parse(input);
  return transaction(async (db) => {
    const unit = await authorizeUnit(db, userId, data.unitId, true);
    return idempotent(db, userId, data, async () => {
      if (data.birthDate > unit.today || data.birthDate < '1900-01-01')
        throw new AppError(
          'Informe uma data de nascimento válida, a partir de 1900 e não futura.',
        );
      const personData = { name: data.name, birth_date: dateValue(data.birthDate), cpf: data.cpf || null };
      const person = data.personId
        ? await db.person.update({ where: { id: data.personId }, data: personData })
        : data.cpf
          ? await db.person.upsert({ where: { cpf: data.cpf }, create: personData, update: personData })
          : await db.person.create({ data: personData });
      const key = { unit_id: data.unitId, day: dateValue(unit.today), service: data.service };
      const counter = await db.counter.upsert({ where: { unit_id_day_service: key }, create: { ...key, value: 1 }, update: { value: { increment: 1 } } });
      const ticket = await db.ticket.create({ data: { ...key, person_id: person.id, number: counter.value }, select: { id: true, service: true, number: true, issued_at: true } });
      return {
        ...ticket,
        unitName: unit.name,
        timezone: unit.timezone,
        day: unit.today,
      };
    });
  });
}
export async function callTicket(userId: string, input: unknown) {
  const data = callSchema.parse(input);
  return transaction(async (db) => {
    const unit = await authorizeUnit(db, userId, data.unitId, true);
    return idempotent(db, userId, data, async () => {
      // Both desk configuration and queue operations lock the unit first.
      const desk = await db.desk.findFirst({ where: { id: data.deskId, unit_id: data.unitId, active: true } });
      if (!desk) throw new AppError('Guichê indisponível.', 404);
      const ticket = await db.ticket.findFirst({
        where: { unit_id: data.unitId, day: dateValue(unit.today), ...(data.action === 'next' ? { called_at: null } : { current: { some: { desk_id: data.deskId } } }) },
        orderBy: [{ issued_at: 'asc' }, { id: 'asc' }], select: { id: true, service: true, number: true },
      });
      if (!ticket)
        return {
          empty: true,
          message:
            data.action === 'next'
              ? 'Não há senhas aguardando.'
              : 'Não há senha atual para repetir.',
        };
      if (data.action === 'next') {
        await db.$executeRaw`UPDATE tickets SET called_at=clock_timestamp() WHERE id=${ticket.id}::uuid`;
        await db.deskCurrent.upsert({ where: { desk_id: desk.id }, create: { desk_id: desk.id, unit_id: unit.id, ticket_id: ticket.id }, update: { ticket_id: ticket.id } });
      }
      const event = await db.callEvent.create({ data: { unit_id: unit.id, ticket_id: ticket.id, desk_id: desk.id, desk_name: desk.name } });
      return {
        ...ticket,
        eventId: event.id.toString(),
        calledAt: event.called_at,
        deskName: desk.name,
      };
    });
  });
}
