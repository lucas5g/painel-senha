import { prisma, transaction, businessDay, dateOnly, dateValue } from './db';
import { authorizeUnit } from './queue';
import { AppError } from './domain';

export async function publicPanel(unitId: string, after: string | null) {
  return transaction(async db => {
    const unit = await db.unit.findFirst({ where: { id: unitId, active: true }, select: { id: true, name: true, timezone: true } });
    if (!unit) throw new AppError('Unidade não encontrada.', 404);
    const today = await businessDay(db, unit.timezone);
    const rows = await db.callEvent.findMany({
      where: { unit_id: unitId, ticket: { day: dateValue(today) }, ...(after !== null ? { id: { gt: BigInt(after) } } : {}) },
      select: { id: true, desk_name: true, called_at: true, ticket: { select: { service: true, number: true } } },
      orderBy: { id: after !== null ? 'asc' : 'desc' }, take: after !== null ? 100 : 6,
    });
    if (after === null) rows.reverse();
    const events = rows.map(({ id, ticket, ...event }) => ({ ...event, ...ticket, id: id.toString() }));
    const cursor = events.at(-1)?.id ?? after ?? (await db.callEvent.aggregate({ where: { unit_id: unitId }, _max: { id: true } }))._max.id?.toString() ?? '0';
    return { unit: { ...unit, today }, events, cursor };
  }, 'RepeatableRead');
}

export async function userUnits(userId: string) {
  return transaction(async db => {
    const units = await db.unit.findMany({ where: { active: true, memberships: { some: { user_id: userId } } }, select: { id: true, name: true, timezone: true }, orderBy: { name: 'asc' } });
    return Promise.all(units.map(async unit => ({ ...unit, today: await businessDay(db, unit.timezone) })));
  });
}

export async function configuration() {
  const [units, desks, users] = await Promise.all([
    prisma.unit.findMany({ orderBy: { name: 'asc' } }),
    prisma.desk.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, email: true, active: true, memberships: { select: { unit_id: true } } } }),
  ]);
  return { units, desks, users: users.map(({ memberships, ...user }) => ({ ...user, unit_ids: memberships.map(m => m.unit_id) })) };
}

export async function findPeople(userId: string, unitId: string, search: { cpf: string } | { name: string; birthDate: string }) {
  return transaction(async db => {
    await authorizeUnit(db, userId, unitId);
    const people = await db.person.findMany({
      where: 'cpf' in search ? { cpf: search.cpf } : {
        name: { contains: search.name.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' }, birth_date: dateValue(search.birthDate),
      },
      select: { id: true, name: true, cpf: true, birth_date: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 50,
    });
    return people.map(person => ({ ...person, birth_date: dateOnly(person.birth_date) }));
  });
}

export async function deskState(userId: string, unitId: string, deskId: string | null) {
  return transaction(async db => {
    const unit = await authorizeUnit(db, userId, unitId);
    const desks = await db.desk.findMany({ where: { unit_id: unitId, active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
    const groups = await db.ticket.groupBy({ by: ['service'], where: { unit_id: unitId, day: dateValue(unit.today), called_at: null }, _count: { _all: true } });
    const waiting = groups.map(group => ({ service: group.service, count: group._count._all }));
    const current = deskId ? await db.deskCurrent.findFirst({
      where: { desk_id: deskId, unit_id: unitId, ticket: { day: dateValue(unit.today) }, desk: { active: true } },
      select: { ticket: { select: { id: true, service: true, number: true } } },
    }) : null;
    return { desks, waiting, current: current?.ticket ?? null, today: unit.today };
  });
}
