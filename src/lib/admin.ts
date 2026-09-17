import { z } from 'zod';
import { transaction } from './db';
import { hashPassword } from './auth';
import { AppError } from './domain';
const uuid = z.string().uuid();
const schema = z.discriminatedUnion('entity', [
  z.object({
    entity: z.literal('unit'),
    id: uuid.optional(),
    name: z.string().trim().min(2).max(100),
    timezone: z.string().max(100),
    active: z.boolean(),
  }),
  z.object({
    entity: z.literal('desk'),
    id: uuid.optional(),
    name: z.string().trim().min(1).max(50),
    unitId: uuid,
    active: z.boolean(),
  }),
  z.object({
    entity: z.literal('user'),
    id: uuid.optional(),
    name: z.string().trim().min(2).max(100),
    email: z.email().transform((s) => s.toLowerCase()),
    password: z.string().max(200),
    active: z.boolean(),
    unitIds: z.array(uuid).max(500),
  }),
]);
export async function saveConfiguration(userId: string, input: unknown) {
  const data = schema.parse(input);
  const passwordHash =
    data.entity === 'user' && data.password
      ? await hashPassword(z.string().min(12).parse(data.password))
      : null;
  return transaction(async (db) => {
    if (data.entity === 'unit') {
      try {
        new Intl.DateTimeFormat('pt-BR', { timeZone: data.timezone });
      } catch {
        throw new AppError('Fuso horário inválido.');
      }
      // Lock order is unit, then desk, matching queue operations.
      if (data.id) {
        await db.$queryRaw`SELECT id FROM units WHERE id=${data.id}::uuid FOR UPDATE`;
        const old = await db.unit.findUnique({ where: { id: data.id } });
        if (!old) throw new AppError('Unidade não encontrada.', 404);
        if (old.timezone !== data.timezone) {
          const ticket = await db.ticket.findFirst({ where: { unit_id: data.id }, select: { id: true } });
          if (ticket)
            throw new AppError(
              'O fuso de uma unidade com senhas emitidas não pode ser alterado.',
            );
        }
        await db.unit.update({ where: { id: data.id }, data: { name: data.name, timezone: data.timezone, active: data.active } });
      } else {
        await db.unit.create({ data: { name: data.name, timezone: data.timezone, active: data.active, memberships: { create: { user_id: userId } } } });
      }
    } else if (data.entity === 'desk') {
      const units = await db.$queryRaw<{ id: string }[]>`SELECT id FROM units WHERE id=${data.unitId}::uuid FOR UPDATE`;
      if (!units.length) throw new AppError('Unidade não encontrada.', 404);
      if (data.id) {
        const result = await db.desk.updateMany({ where: { id: data.id, unit_id: data.unitId }, data: { name: data.name, active: data.active } });
        if (!result.count)
          throw new AppError('Guichê não encontrado nesta unidade.', 404);
      } else
        await db.desk.create({ data: { unit_id: data.unitId, name: data.name, active: data.active } });
    } else {
      if (data.id === userId && !data.active)
        throw new AppError('Você não pode desativar seu próprio acesso.');
      let id = data.id;
      if (id) {
        const result = await db.user.updateMany({ where: { id }, data: { name: data.name, email: data.email, active: data.active, ...(passwordHash ? { password_hash: passwordHash } : {}) } });
        if (!result.count)
          throw new AppError('Usuário não encontrado.', 404);
        if (passwordHash || !data.active)
          await db.session.deleteMany({ where: { user_id: id } });
      } else {
        if (!passwordHash)
          throw new AppError('Informe uma senha de pelo menos 12 caracteres.');
        id = (await db.user.create({ data: { name: data.name, email: data.email, password_hash: passwordHash, active: data.active } })).id;
      }
      await db.userUnit.deleteMany({ where: { user_id: id } });
      await db.userUnit.createMany({ data: [...new Set(data.unitIds)].map(unit_id => ({ user_id: id!, unit_id })) });
    }
    return { ok: true };
  });
}
