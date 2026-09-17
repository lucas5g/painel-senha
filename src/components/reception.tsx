'use client';
import { useRef, useState } from 'react';
import { api, requestId, type Person, type Ticket, type Unit } from './client';
import { age, code, services, type Service } from '@/lib/domain';
export default function Reception({ unit }: { unit: Unit }) {
  const [cpf, setCpf] = useState('');
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [personId, setPersonId] = useState<string>();
  const [service, setService] = useState<Service>();
  const [matches, setMatches] = useState<Person[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [ticket, setTicket] = useState<Ticket>();
  const pending = useRef<{ fingerprint: string; id: string } | null>(null);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: unit.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  async function search() {
    setBusy(true);
    setError('');
    setMessage('');
    setMatches([]);
    setSearched(false);
    setPersonId(undefined);
    try {
      const query = new URLSearchParams({
        unitId: unit.id,
        ...(cpf.trim() ? { cpf } : { name, birthDate: birth }),
      });
      const rows = await api<Person[]>(`/people?${query}`);
      setMatches(rows);
      setSearched(true);
      if (cpf.trim() && rows.length === 1) select(rows[0]);
      else
        setMessage(
          rows.length
            ? 'Confira e selecione o cadastro correto abaixo.'
            : 'Nenhum cadastro encontrado. Confira os dados para cadastrar e emitir.',
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function select(person: Person) {
    setPersonId(person.id);
    setName(person.name);
    setBirth(person.birth_date);
    setCpf(person.cpf || '');
    setMatches([]);
    setMessage('Cadastro recuperado. Confira os dados antes de emitir.');
  }
  function reset() {
    setCpf('');
    setName('');
    setBirth('');
    setPersonId(undefined);
    setService(undefined);
    setMatches([]);
    setSearched(false);
    setTicket(undefined);
    setMessage('');
    setError('');
    pending.current = null;
  }
  return (
    <div className="columns">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">01 · IDENTIFICAÇÃO</p>
            <h2>Dados do assistido</h2>
          </div>
          <span className="pill">
            {personId ? 'Cadastro existente' : 'Cadastro'}
          </span>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!service || busy || ticket) return;
            setBusy(true);
            setError('');
            const body = {
              action: 'issue',
              unitId: unit.id,
              personId,
              name,
              birthDate: birth,
              cpf,
              service,
            };
            const fingerprint = JSON.stringify(body);
            if (pending.current?.fingerprint !== fingerprint)
              pending.current = { fingerprint, id: requestId() };
            try {
              setTicket(
                await api<Ticket>('/issue', {
                  ...body,
                  requestId: pending.current.id,
                }),
              );
              setMessage('Senha emitida com sucesso.');
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy || !!ticket}>
            <label>
              CPF <span className="muted">(opcional)</span>
              <input
                value={cpf}
                inputMode="numeric"
                maxLength={14}
                placeholder="000.000.000-00"
                onChange={(e) => {
                  setCpf(e.target.value);
                  setPersonId(undefined);
                  setMatches([]);
                  setSearched(false);
                  setName('');
                  setBirth('');
                  setMessage('');
                }}
              />
            </label>
            <p className="hint">
              Sem CPF? Informe nome e nascimento e busque o cadastro antes de
              emitir.
            </p>
            <div className="form-grid">
              <label>
                Nome completo
                <input
                  value={name}
                  required
                  minLength={2}
                  maxLength={200}
                  autoComplete="off"
                  onChange={(e) => {
                    setName(e.target.value);
                    setSearched(false);
                  }}
                />
              </label>
              <label>
                Data de nascimento
                <input
                  type="date"
                  value={birth}
                  required
                  min="1900-01-01"
                  max={today}
                  onChange={(e) => {
                    setBirth(e.target.value);
                    setSearched(false);
                  }}
                />
              </label>
            </div>
            <div className="row spread">
              <button type="button" className="secondary" onClick={search}>
                Buscar cadastro
              </button>
              {birth && <span className="muted">{age(birth, today)} anos</span>}
            </div>
            {matches.length > 0 && (
              <div className="matches">
                <h3>Cadastros encontrados</h3>
                {matches.map((p) => (
                  <button
                    type="button"
                    className="match"
                    key={p.id}
                    onClick={() => select(p)}
                  >
                    <strong>{p.name}</strong>
                    <span>
                      {p.birth_date.split('-').reverse().join('/')} ·{' '}
                      {p.cpf ? `CPF ${p.cpf}` : 'Sem CPF'} · {p.id.slice(0, 8)}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setMatches([]);
                    setPersonId(undefined);
                    setMessage('Novo cadastro selecionado.');
                  }}
                >
                  Nenhum destes — criar novo cadastro
                </button>
              </div>
            )}
            <hr />
            <p className="eyebrow">02 · ATENDIMENTO</p>
            <h2>Qual atendimento deseja?</h2>
            <div className="service-options">
              {Object.entries(services).map(([id, label]) => (
                <label
                  key={id}
                  className={`service-option ${id} ${service === id ? 'checked' : ''}`}
                >
                  <input
                    type="radio"
                    name="service"
                    value={id}
                    checked={service === id}
                    onChange={() => setService(id as Service)}
                    required
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{id}</small>
                  </span>
                </label>
              ))}
            </div>
            <button
              className="wide"
              disabled={!service || busy || (!cpf && !personId && !searched)}
            >
              {busy ? 'Emitindo…' : 'Emitir senha'}
            </button>
            {!cpf && !personId && !searched && (
              <p className="hint">
                Busque por nome e nascimento para habilitar a emissão sem CPF.
              </p>
            )}
          </fieldset>
        </form>
        {message && (
          <p role="status" className="success">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error} Você pode tentar novamente.
          </p>
        )}
      </section>
      <aside>
        <section className="card receipt-card">
          <p className="eyebrow">COMPROVANTE</p>
          {ticket ? (
            <>
              <div id="receipt">
                <p>{ticket.unitName}</p>
                <h2 className="ticket-code">
                  {code(ticket.service, ticket.number)}
                </h2>
                <p>
                  <strong>{services[ticket.service as Service]}</strong>
                </p>
                <p>
                  {new Date(ticket.issued_at).toLocaleString('pt-BR', {
                    timeZone: ticket.timezone,
                  })}
                </p>
                <p>Aguarde a chamada no painel.</p>
              </div>
              <button className="wide" onClick={() => window.print()}>
                Imprimir comprovante
              </button>
              <button className="secondary wide" onClick={reset}>
                Novo atendimento
              </button>
              <p className="hint">
                Se a impressão falhar, clique novamente em imprimir. Sua senha
                já está registrada.
              </p>
            </>
          ) : (
            <div className="empty">
              <span className="ticket-placeholder">— — —</span>
              <h3>A próxima senha começa aqui</h3>
              <p className="muted">
                Após a emissão, o comprovante ficará disponível para impressão.
              </p>
            </div>
          )}
        </section>
        <section className="note">
          <strong>Uma fila, por ordem de chegada</strong>
          <p>
            Todos os guichês atendem todos os tipos. As senhas são válidas para
            o dia de emissão.
          </p>
        </section>
      </aside>
    </div>
  );
}
