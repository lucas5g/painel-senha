'use client';
import { useEffect, useState } from 'react';
import { api } from './client';
type Unit = { id: string; name: string; timezone: string; active: boolean };
type Desk = { id: string; name: string; unit_id: string; active: boolean };
type User = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  unit_ids: string[];
};
type Data = { units: Unit[]; desks: Desk[]; users: User[] };
type Form = {
  entity: 'unit' | 'desk' | 'user';
  id?: string;
  name: string;
  active: boolean;
  timezone: string;
  email: string;
  password: string;
  unitId: string;
  unitIds: string[];
};
const empty = (entity: Form['entity']): Form => ({
  entity,
  name: '',
  active: true,
  timezone: 'America/Sao_Paulo',
  email: '',
  password: '',
  unitId: '',
  unitIds: [],
});
export default function Configuration({
  onChange,
}: {
  onChange: () => Promise<void>;
}) {
  const [data, setData] = useState<Data>({ units: [], desks: [], users: [] });
  const [form, setForm] = useState<Form>(empty('unit'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function load() {
    try {
      setData(await api<Data>('/configuration'));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const patch = (value: Partial<Form>) =>
    setForm((old) => ({ ...old, ...value }));
  return (
    <>
      <p className="muted">
        Todos os usuários autenticados podem gerenciar estas configurações. Os
        vínculos definem em quais unidades cada usuário pode emitir e chamar.
      </p>
      <div className="columns">
        <section className="card">
          <nav className="tabs" aria-label="Tipo de configuração">
            {(['unit', 'desk', 'user'] as const).map((entity, i) => (
              <button
                disabled={busy}
                key={entity}
                className={form.entity === entity ? 'selected' : 'ghost'}
                onClick={() => {
                  setForm(empty(entity));
                  setMessage('');
                  setError('');
                }}
              >
                {['Unidades', 'Guichês', 'Usuários'][i]}
              </button>
            ))}
          </nav>
          <h2>
            {form.id ? 'Editar' : 'Cadastrar'}{' '}
            {form.entity === 'unit'
              ? 'unidade'
              : form.entity === 'desk'
                ? 'guichê'
                : 'usuário'}
          </h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              setMessage('');
              try {
                await api('/configuration', form);
                setMessage('Configuração salva.');
                setForm(empty(form.entity));
                await load();
                await onChange();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Nome
                <input
                  required
                  minLength={form.entity === 'desk' ? 1 : 2}
                  maxLength={form.entity === 'desk' ? 50 : 100}
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </label>
              {form.entity === 'unit' && (
                <label>
                  Fuso horário
                  <input
                    required
                    value={form.timezone}
                    onChange={(e) => patch({ timezone: e.target.value })}
                  />
                  <span className="hint">
                    Ex.: America/Sao_Paulo. Defina antes da primeira emissão.
                  </span>
                </label>
              )}
              {form.entity === 'desk' && (
                <label>
                  Unidade
                  <select
                    required
                    value={form.unitId}
                    disabled={!!form.id}
                    onChange={(e) => patch({ unitId: e.target.value })}
                  >
                    <option value="">Selecione</option>
                    {data.units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {form.entity === 'user' && (
                <>
                  <label>
                    E-mail
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => patch({ email: e.target.value })}
                    />
                  </label>
                  <label>
                    {form.id ? 'Nova senha (deixe vazia para manter)' : 'Senha'}
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      required={!form.id}
                      value={form.password}
                      onChange={(e) => patch({ password: e.target.value })}
                    />
                    <span className="hint">Pelo menos 12 caracteres.</span>
                  </label>
                  <fieldset>
                    <legend>Unidades autorizadas para operação</legend>
                    {data.units.map((u) => (
                      <label className="check" key={u.id}>
                        <input
                          type="checkbox"
                          checked={form.unitIds.includes(u.id)}
                          onChange={(e) =>
                            patch({
                              unitIds: e.target.checked
                                ? [...form.unitIds, u.id]
                                : form.unitIds.filter((id) => id !== u.id),
                            })
                          }
                        />
                        {u.name}
                        {!u.active && ' (inativa)'}
                      </label>
                    ))}
                  </fieldset>
                </>
              )}
              <label className="check">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => patch({ active: e.target.checked })}
                />
                Ativo
              </label>
              <div className="actions">
                <button disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
                {form.id && (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setForm(empty(form.entity))}
                  >
                    Cancelar edição
                  </button>
                )}
              </div>
            </fieldset>
          </form>
          {message && (
            <p className="success" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
        <section className="card">
          <h2>Registros cadastrados</h2>
          <p className="hint">
            Selecione para editar ou desativar. O histórico é preservado.
          </p>
          {form.entity === 'unit' &&
            data.units.map((u) => (
              <button
                disabled={busy}
                className="record"
                key={u.id}
                onClick={() => setForm({ ...empty('unit'), ...u })}
              >
                <strong>{u.name}</strong>
                <span>
                  {u.timezone} · {u.active ? 'Ativa' : 'Inativa'}
                </span>
              </button>
            ))}
          {form.entity === 'desk' &&
            data.desks.map((d) => (
              <button
                disabled={busy}
                className="record"
                key={d.id}
                onClick={() =>
                  setForm({ ...empty('desk'), ...d, unitId: d.unit_id })
                }
              >
                <strong>{d.name}</strong>
                <span>
                  {data.units.find((u) => u.id === d.unit_id)?.name} ·{' '}
                  {d.active ? 'Ativo' : 'Inativo'}
                </span>
              </button>
            ))}
          {form.entity === 'user' &&
            data.users.map((u) => (
              <button
                disabled={busy}
                className="record"
                key={u.id}
                onClick={() =>
                  setForm({ ...empty('user'), ...u, unitIds: u.unit_ids })
                }
              >
                <strong>{u.name}</strong>
                <span>
                  {u.email} · {u.active ? 'Ativo' : 'Inativo'}
                </span>
              </button>
            ))}
        </section>
      </div>
    </>
  );
}
