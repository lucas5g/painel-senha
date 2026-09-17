import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser, requireUser, login, logout } from '@/lib/auth';
import { AppError, validCpf } from '@/lib/domain';
import { issueTicket, callTicket } from '@/lib/queue';
import { saveConfiguration } from '@/lib/admin';
import { publicPanel, userUnits, configuration, findPeople, deskState } from '@/lib/queries';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const uuid = z.string().uuid();
function json(value: unknown) {
  return NextResponse.json(value, { headers: { 'Cache-Control': 'no-store' } });
}
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const path = (await context.params).path.join('/');
    const query = request.nextUrl.searchParams;
    if (request.method === 'POST') {
      const origin = request.headers.get('origin');
      if (!process.env.APP_ORIGIN || origin !== new URL(process.env.APP_ORIGIN).origin) throw new AppError('Origem da requisição não autorizada.', 403);
      const text = await request.text();
      if (text.length > 20000) throw new AppError('Requisição muito grande.', 413);
      const body = JSON.parse(text || '{}');
      if (path === 'login') {
        const data = z.object({ email: z.email().transform(v => v.trim().toLowerCase()), password: z.string().min(1).max(200) }).parse(body);
        await login(data.email, data.password); return json({ ok: true });
      }
      const user = await requireUser();
      if (path === 'logout') { await logout(); return json({ ok: true }); }
      if (path === 'issue') return json(await issueTicket(user.id, body));
      if (path === 'call') return json(await callTicket(user.id, body));
      if (path === 'configuration') return json(await saveConfiguration(user.id, body));
    } else {
      if (path === 'public') {
        const unitId = uuid.parse(query.get('unitId'));
        const after = query.get('after');
        if (after !== null && !/^\d{1,18}$/.test(after)) throw new AppError('Cursor inválido.');
        return json(await publicPanel(unitId, after));
      }
      if (path === 'session') return json({ user: await currentUser() ?? null });
      const user = await requireUser();
      if (path === 'units') return json(await userUnits(user.id));
      if (path === 'configuration') return json(await configuration());
      if (path === 'people') {
        const unitId = uuid.parse(query.get('unitId'));
        const cpf = (query.get('cpf') || '').replace(/[.\-\s]/g, '');
        if (cpf && !validCpf(cpf)) throw new AppError('CPF inválido.');
        const search = cpf ? { cpf } : { name: z.string().trim().min(2).max(200).parse(query.get('name')), birthDate: z.iso.date().parse(query.get('birthDate')) };
        return json(await findPeople(user.id, unitId, search));
      }
      if (path === 'desk') {
        const unitId = uuid.parse(query.get('unitId'));
        const deskId = query.get('deskId') ? uuid.parse(query.get('deskId')) : null;
        return json(await deskState(user.id, unitId, deskId));
      }
    }
    throw new AppError('Recurso não encontrado.', 404);
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Confira os campos informados.', details: error.issues.map(i => `${i.path.join('.')}: ${i.message}`) }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
    const dbError = error as { code?: string };
    if (dbError.code === 'P2002') return NextResponse.json({ error: 'Já existe um registro com esse CPF, e-mail ou nome de guichê.' }, { status: 409 });
    if (dbError.code === 'P2003') return NextResponse.json({ error: 'Um dos registros selecionados não existe mais.' }, { status: 400 });
    if (dbError.code === 'P2025') return NextResponse.json({ error: 'Cadastro não encontrado.' }, { status: 404 });
    // Prisma errors may include query parameters; don't log personal data.
    console.error('Falha na operação', dbError.code ?? 'Erro desconhecido');
    return NextResponse.json({ error: 'Não foi possível concluir. Verifique a conexão e tente novamente.' }, { status: 500 });
  }
}
export const GET = handle;
export const POST = handle;
