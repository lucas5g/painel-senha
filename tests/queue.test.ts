import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

test('PostgreSQL / Prisma integration', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL!);
  assert.ok(url.pathname.endsWith('_test'), 'TEST_DATABASE_URL must point to a disposable database ending in _test');
  process.env.DATABASE_URL = url.toString();
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: process.env, stdio: 'pipe' });
  const { prisma: db, dateValue, dateOnly } = await import('../src/lib/db');
  const { issueTicket, callTicket } = await import('../src/lib/queue');
  const { saveConfiguration } = await import('../src/lib/admin');
  const { publicPanel, findPeople, deskState, configuration, userUnits } = await import('../src/lib/queries');
  const userId = randomUUID(), unitId = randomUUID(), otherUnitId = randomUUID(), deskA = randomUUID(), deskB = randomUUID();
  await db.user.create({ data: { id: userId, name: 'Integration', email: `${userId}@example.test`, password_hash: 'unused' } });
  await db.unit.createMany({ data: [{ id: unitId, name: 'A' }, { id: otherUnitId, name: 'B' }] });
  await db.userUnit.createMany({ data: [unitId, otherUnitId].map(unit_id => ({ user_id: userId, unit_id })) });
  await db.desk.createMany({ data: [{ id: deskA, unit_id: unitId, name: '01' }, { id: deskB, unit_id: unitId, name: '02' }] });
  const issue = (extra = {}) => ({ action: 'issue', requestId: randomUUID(), unitId, name: 'Assistido Teste', birthDate: '1990-01-01', cpf: '', service: 'FAM', ...extra });
  const call = (extra = {}) => ({ action: 'next', requestId: randomUUID(), unitId, deskId: deskA, ...extra });
  type Ticket = { id: string; number: number; service: string; empty?: boolean; eventId?: string };
  try {
    await t.test('concurrent emissions have independent unique atomic counters', async () => {
      const results = await Promise.all(Array.from({ length: 12 }, () => issueTicket(userId, issue()))) as Ticket[];
      assert.deepEqual(results.map(r => r.number).sort((a,b) => a-b), Array.from({ length: 12 },(_,i) => i+1));
      assert.equal((await issueTicket(userId,issue({ service:'CRI' })) as Ticket).number,1);
      assert.equal((await issueTicket(userId,issue({ unitId:otherUnitId })) as Ticket).number,1);
    });
    await t.test('same request concurrently issues one ticket and rejects changed payload', async () => {
      const input = issue();
      const results = await Promise.all([issueTicket(userId,input),issueTicket(userId,input)]) as Ticket[];
      assert.equal(results[0].id,results[1].id);
      await assert.rejects(issueTicket(userId,{ ...input,name:'Changed' }), /outra operação/);
    });
    await t.test('concurrent desks claim distinct tickets in FIFO order across types', async () => {
      const expected = await db.ticket.findMany({ where: { unit_id: unitId }, orderBy: [{ issued_at:'asc' }, { id:'asc' }], take: 2 });
      const actual = await Promise.all([callTicket(userId,call()),callTicket(userId,call({ deskId:deskB }))]) as Ticket[];
      assert.equal(new Set(actual.map(t => t.id)).size,2);
      assert.deepEqual(actual.map(t => t.id).sort(),expected.map(t => t.id).sort());
    });
    await t.test('recall creates event but never advances queue; retry creates no second event', async () => {
      const current = await db.deskCurrent.findUniqueOrThrow({ where: { desk_id: deskA } });
      const before = await db.ticket.count({ where: { unit_id: unitId, called_at: null } });
      const input = call({ action:'recall' });
      const result = await callTicket(userId,input) as Ticket;
      const repeated = await callTicket(userId,input) as Ticket;
      assert.equal(result.id,current.ticket_id); assert.equal(result.eventId,repeated.eventId);
      assert.equal(await db.ticket.count({ where: { unit_id: unitId, called_at: null } }),before);
    });
    await t.test('Prisma dates and BigInt cursors retain public/private API contracts', async () => {
      const panel = await publicPanel(unitId,null);
      assert.equal(typeof panel.cursor,'string');
      assert.ok(panel.events.length > 0);
      assert.doesNotThrow(() => JSON.stringify(panel));
      assert.deepEqual(Object.keys(panel.events[0]).sort(), ['id','desk_name','called_at','service','number'].sort());
      assert.equal((await publicPanel(unitId,panel.cursor)).events.length,0);
      const state = await deskState(userId,unitId,deskA);
      assert.ok(state.current); assert.equal(state.desks.length,2);
      const units = await userUnits(userId);
      assert.equal(units.length,2);
      assert.match(units[0].today,/^\d{4}-\d{2}-\d{2}$/);
      const config = await configuration();
      assert.ok(!JSON.stringify(config).includes('password_hash'));
      assert.deepEqual(config.users.find(u => u.id === userId)?.unit_ids.sort(),[unitId,otherUnitId].sort());
    });
    await t.test('reused CPF preserves identity; selected no-CPF registration is reusable', async () => {
      const first = await issueTicket(userId,issue({ cpf:'52998224725' })) as Ticket;
      const second = await issueTicket(userId,issue({ cpf:'52998224725' })) as Ticket;
      const people = await db.ticket.findMany({ where: { id: { in: [first.id,second.id] } } });
      assert.equal(people[0].person_id,people[1].person_id);
      const existing = await db.ticket.findFirstOrThrow({ where: { unit_id: unitId }, orderBy: { issued_at:'asc' } });
      const third = await issueTicket(userId,issue({ personId:existing.person_id })) as Ticket;
      assert.equal((await db.ticket.findUniqueOrThrow({ where: { id: third.id } })).person_id,existing.person_id);
      const found = await findPeople(userId,unitId,{ cpf:'52998224725' });
      assert.equal(found[0].birth_date,'1990-01-01');
      assert.equal((await findPeople(userId,unitId,{ name:'assistido',birthDate:'1990-01-01' })).length > 0,true);
      assert.equal((await findPeople(userId,unitId,{ name:'%_',birthDate:'1990-01-01' })).length,0);
    });
    await t.test('failed operation rolls back its counter and registration changes', async () => {
      const before = await db.ticket.count({ where: { unit_id: unitId } });
      await assert.rejects(issueTicket(userId,issue({ personId:randomUUID() })), { code:'P2025' });
      assert.equal(await db.ticket.count({ where: { unit_id: unitId } }),before);
    });
    await t.test('old waiting/current tickets disappear and next day starts at 001 without erasure', async () => {
      await db.$executeRaw`UPDATE tickets SET day=day-1 WHERE unit_id=${unitId}::uuid`;
      await db.counter.deleteMany({ where: { unit_id: unitId } });
      assert.equal((await callTicket(userId,call()) as Ticket).empty,true);
      assert.equal((await callTicket(userId,call({ action:'recall' })) as Ticket).empty,true);
      assert.equal((await publicPanel(unitId,null)).events.length,0);
      const fresh = await issueTicket(userId,issue()) as Ticket;
      assert.equal(fresh.number,1);
      assert.equal((await callTicket(userId,call()) as Ticket).id,fresh.id);
      assert.ok(await db.ticket.count({ where: { unit_id: unitId } })>1);
    });
    await t.test('unit timezone defines date independently of server timezone', async () => {
      const timezone = 'Pacific/Kiritimati';
      await db.unit.update({ where: { id: otherUnitId }, data: { timezone } });
      const issued = await issueTicket(userId,issue({ unitId:otherUnitId, service:'TRI' })) as Ticket;
      const [date] = await db.$queryRaw<{ correct: boolean }[]>`SELECT day=(clock_timestamp() AT TIME ZONE ${timezone})::date AS correct FROM tickets WHERE id=${issued.id}::uuid`;
      assert.equal(date.correct,true);
      assert.equal(dateOnly(dateValue('1990-01-01')),'1990-01-01');
    });
    await t.test('server rejects invalid CPF, future birthdate, cross-unit desk and unauthorized unit', async () => {
      await assert.rejects(issueTicket(userId,issue({ cpf:'11111111111' })));
      await assert.rejects(issueTicket(userId,issue({ birthDate:'2999-01-01' })), /nascimento/);
      await assert.rejects(callTicket(userId,call({ unitId:otherUnitId })), /Guichê/);
      await db.userUnit.delete({ where: { user_id_unit_id: { user_id:userId,unit_id:otherUnitId } } });
      await assert.rejects(issueTicket(userId,issue({ unitId:otherUnitId })), /autorizado/);
    });
    await t.test('configuration preserves timezone after issuance and prevents self-deactivation', async () => {
      await assert.rejects(saveConfiguration(userId,{ entity:'unit',id:unitId,name:'Unidade A',timezone:'UTC',active:true }), /fuso/);
      await assert.rejects(saveConfiguration(userId,{ entity:'user',id:userId,name:'Integration',email:`${userId}@example.test`,password:'',active:false,unitIds:[] }), /próprio/);
    });
  } finally {
    const unitFilter = { unit_id: { in: [unitId,otherUnitId] } };
    const tickets = await db.ticket.findMany({ where: unitFilter, select: { person_id: true } });
    await db.operation.deleteMany({ where: { user_id: userId } });
    await db.callEvent.deleteMany({ where: unitFilter });
    await db.deskCurrent.deleteMany({ where: unitFilter });
    await db.ticket.deleteMany({ where: unitFilter });
    await db.person.deleteMany({ where: { id: { in: tickets.map(t => t.person_id) } } });
    await db.counter.deleteMany({ where: unitFilter });
    await db.desk.deleteMany({ where: unitFilter });
    await db.userUnit.deleteMany({ where: { user_id: userId } });
    await db.unit.deleteMany({ where: { id: { in: [unitId,otherUnitId] } } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  }
});
