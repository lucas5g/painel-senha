'use client';
import { useState } from 'react';
import { api } from '@/components/client';
export default function Login() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <section className="card">
        <div className="brand">◉ Painel de Senhas</div>
        <h1>Bem-vindo</h1>
        <p className="muted">Entre para organizar a recepção e as chamadas.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            const form = new FormData(e.currentTarget);
            try {
              await api('/login', {
                email: form.get('email'),
                password: form.get('password'),
              });
              window.location.href = '/';
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            E-mail
            <input type="email" name="email" autoComplete="username" required />
          </label>
          <label>
            Senha
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        </form>
      </section>
    </main>
  );
}
