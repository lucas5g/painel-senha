import { randomBytes, scryptSync } from 'node:crypto';
import { prisma } from '../src/lib/db';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Preencha DATABASE_URL no .env antes de criar o primeiro usuário.');
  const password = process.env.BOOTSTRAP_PASSWORD;
  if (!password || password.length < 12) throw new Error('Defina BOOTSTRAP_PASSWORD com pelo menos 12 caracteres.');
  const email = process.env.BOOTSTRAP_EMAIL?.toLowerCase().trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Defina BOOTSTRAP_EMAIL com um e-mail válido.');
  const salt = randomBytes(16).toString('hex');
  const password_hash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
  const result = await prisma.user.createMany({
    data: [{ name: process.env.BOOTSTRAP_NAME || 'Operador', email, password_hash }], skipDuplicates: true,
  });
  console.log(result.count ? 'Primeiro usuário criado. Cadastre unidades e vínculos em Configurações.' : 'Usuário já existe; senha preservada.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
