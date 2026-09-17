import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { prisma, transaction } from './db';
import { AppError } from './domain';
const derive = promisify(scrypt);
export const tokenHash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${((await derive(password, salt, 64)) as Buffer).toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [salt, expected] = hash.split(':');
  const actual = (await derive(password, salt, 64)) as Buffer;
  return (
    expected.length === 128 &&
    timingSafeEqual(actual, Buffer.from(expected, 'hex'))
  );
}
export async function currentUser() {
  const token = (await cookies()).get('session')?.value;
  if (!token) return null;
  const session = await prisma.session.findFirst({
    where: { token_hash: tokenHash(token), expires_at: { gt: new Date() }, user: { active: true } },
    select: { user: { select: { id: true, name: true, email: true } } },
  });
  return session?.user;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AppError('Faça login para continuar.', 401);
  return user;
}
export async function login(email: string, password: string) {
  const allowed = await transaction(async (db) => {
    await db.loginAttempt.createMany({ data: [{ email }], skipDuplicates: true });
    // Conditional increment is kept atomic using the database clock.
    const [attempt] = await db.$queryRaw<{ attempts: number }[]>`
      UPDATE login_attempts SET attempts=CASE WHEN window_start<now()-interval '15 minutes' THEN 1 ELSE attempts+1 END,
      window_start=CASE WHEN window_start<now()-interval '15 minutes' THEN now() ELSE window_start END
      WHERE email=${email} RETURNING attempts`;
    return attempt.attempts <= 10;
  });
  if (!allowed)
    throw new AppError(
      'Muitas tentativas. Tente novamente em 15 minutos.',
      429,
    );
  const user = await prisma.user.findFirst({ where: { email, active: true } });
  const fallback = `00000000000000000000000000000000:${'0'.repeat(128)}`;
  const valid = await verifyPassword(password, user?.password_hash ?? fallback);
  if (!valid || !user) throw new AppError('E-mail ou senha inválidos.', 401);
  await prisma.loginAttempt.deleteMany({ where: { email } });
  const token = randomBytes(32).toString('hex');
  await prisma.session.create({ data: { token_hash: tokenHash(token), user_id: user.id, expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000) } });
  (await cookies()).set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.APP_ORIGIN?.startsWith('https://') ?? false,
    maxAge: 43200,
    path: '/',
  });
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get('session')?.value;
  if (token)
    await prisma.session.deleteMany({ where: { token_hash: tokenHash(token) } });
  jar.delete('session');
}
