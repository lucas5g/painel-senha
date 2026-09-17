'use client';
import { useEffect, useRef, useState } from 'react';
import { api, requestId, type Unit } from './client';
import { code, services, type Service } from '@/lib/domain';
type State = {
  desks: { id: string; name: string }[];
  waiting: { service: Service; count: number }[];
  current: { id: string; service: Service; number: number } | null;
  today: string;
};
export default function Desk({ unit }: { unit: Unit }) {
  const [state, setState] = useState<State>();
  const [deskId, setDeskId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pending = useRef<{ action: string; deskId: string; id: string } | null>(
    null,
  );
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await api<State>(
          `/desk?${new URLSearchParams({ unitId: unit.id, deskId })}`,
        );
        if (live) {
          setState(next);
          if (!next.desks.some((d) => d.id === deskId))
            setDeskId(next.desks[0]?.id || '');
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        if (live) timer = setTimeout(poll, 2000);
      }
    }
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [unit.id, deskId]);
  async function call(action: 'next' | 'recall') {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    if (
      !pending.current ||
      pending.current.action !== action ||
      pending.current.deskId !== deskId
    )
      pending.current = { action, deskId, id: requestId() };
    try {
      const result = await api<{
        empty?: boolean;
        message?: string;
        service: Service;
        number: number;
      }>('/call', {
        action,
        unitId: unit.id,
        deskId,
        requestId: pending.current.id,
      });
      pending.current = null;
      setMessage(
        result.empty
          ? result.message || ''
          : `${code(result.service, result.number)} chamada no painel.`,
      );
      setState(
        await api<State>(
          `/desk?${new URLSearchParams({ unitId: unit.id, deskId })}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="columns">
      <section className="card">
        <p className="eyebrow">ESTAÇÃO DE ATENDIMENTO</p>
        <label>
          Guichê
          <select
            value={deskId}
            disabled={busy}
            onChange={(e) => {
              setDeskId(e.target.value);
              setState(undefined);
              setMessage('');
              pending.current = null;
            }}
          >
            <option value="" disabled>
              Selecione
            </option>
            {state?.desks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <div className="current-ticket">
          <p className="muted">SENHA ATUAL</p>
          {state?.current ? (
            <>
              <h2 className="ticket-code">
                {code(state.current.service, state.current.number)}
              </h2>
              <span className={`badge ${state.current.service}`}>
                {services[state.current.service]}
              </span>
            </>
          ) : (
            <>
              <h2 className="ticket-code">— — —</h2>
              <p>Nenhuma senha atual</p>
            </>
          )}
        </div>
        <div className="actions">
          <button disabled={busy || !deskId} onClick={() => call('next')}>
            {busy ? 'Processando…' : 'Chamar próxima senha'}
          </button>
          <button
            className="secondary"
            disabled={busy || !deskId || !state?.current}
            onClick={() => call('recall')}
          >
            Chamar novamente
          </button>
        </div>
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
      <aside className="card">
        <p className="eyebrow">FILA DE HOJE</p>
        <h2>
          {state?.waiting.reduce((sum, item) => sum + item.count, 0) ?? '—'}{' '}
          aguardando
        </h2>
        <p className="muted">Ordem de chegada · todos os atendimentos</p>
        {Object.entries(services).map(([id, label]) => (
          <div className="queue-row" key={id}>
            <span className={`badge ${id}`}>{label}</span>
            <strong>
              {state?.waiting.find((w) => w.service === id)?.count ?? 0}
            </strong>
          </div>
        ))}
        {state && !state.waiting.length && (
          <p className="empty">A fila está vazia.</p>
        )}
      </aside>
    </div>
  );
}
