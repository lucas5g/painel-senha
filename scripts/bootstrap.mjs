import pg from 'pg';
import { randomBytes, scryptSync } from 'node:crypto';
const password = process.env.BOOTSTRAP_PASSWORD;
if (!password || password.length < 12) throw new Error('Defina BOOTSTRAP_PASSWORD com pelo menos 12 caracteres.');
const salt = randomBytes(16).toString('hex');
const hash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const result = await pool.query('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING RETURNING id', [process.env.BOOTSTRAP_NAME || 'Operador', process.env.BOOTSTRAP_EMAIL?.toLowerCase().trim(), hash]);
  console.log(result.rowCount ? 'Primeiro usuário criado. Cadastre unidades e vínculos em Configurações.' : 'Usuário já existe; senha preservada.');
} finally { await pool.end(); }
