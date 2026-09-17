'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from './client';
import { code, services, type Service } from '@/lib/domain';
type Call = {
  id: string;
  service: Service;
  number: number;
  desk_name: string;
  called_at: string;
};
type Response = {
  unit: { name: string; today: string };
  events: Call[];
  cursor: string;
};
export default function Panel({ unitId }: { unitId: string }) {
  const [unitName, setUnitName] = useState('Painel de chamadas');
  const [history, setHistory] = useState<Call[]>([]);
  const [current, setCurrent] = useState<Call>();
  const [connected, setConnected] = useState(false);
  const [sound, setSound] = useState(false);
  const [error, setError] = useState('');
  const audio = useRef<AudioContext | null>(null);
  const soundEnabled = useRef(false);
  useEffect(() => {
    let live = true;
    let cursor: string | undefined;
    let day = '';
    let timer: ReturnType<typeof setTimeout>;
    let nextPresentation = 0;
    const pending: Call[] = [];
    function show(event: Call, play: boolean) {
      setCurrent(event);
      setHistory((old) =>
        [event, ...old.filter((item) => item.id !== event.id)].slice(0, 6),
      );
      if (play && soundEnabled.current && audio.current?.state === 'running') {
        const ctx = audio.current;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.frequency.value = 740;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.7);
      }
    }
    const presenter = setInterval(() => {
      if (Date.now() >= nextPresentation && pending.length) {
        show(pending.shift()!, true);
        nextPresentation = Date.now() + 2500;
      }
      if (soundEnabled.current && audio.current?.state !== 'running') {
        soundEnabled.current = false;
        setSound(false);
      }
    }, 100);
    async function poll() {
      try {
        const result = await api<Response>(
          `/public?${new URLSearchParams({ unitId, ...(cursor === undefined ? {} : { after: cursor }) })}`,
        );
        if (!live) return;
        setUnitName(result.unit.name);
        setConnected(true);
        setError('');
        if (day && day !== result.unit.today) {
          pending.length = 0;
          setHistory([]);
          setCurrent(undefined);
        }
        day = result.unit.today;
        if (cursor === undefined) {
          setHistory([...result.events].reverse());
          if (result.events.length) setCurrent(result.events.at(-1));
        } else pending.push(...result.events);
        cursor = result.cursor;
      } catch (e) {
        if (live) {
          setConnected(false);
          setError((e as Error).message);
        }
      } finally {
        if (live) timer = setTimeout(poll, 1000);
      }
    }
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
      clearInterval(presenter);
    };
  }, [unitId]);
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  async function enableSound() {
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      soundEnabled.current = audio.current.state === 'running';
      setSound(soundEnabled.current);
    } catch {
      setError('Não foi possível ativar o som neste navegador.');
    }
  }
  return (
    <main className="panel">
      <header className="panel-header">
        <div>
          <p className="eyebrow">PAINEL DE CHAMADAS</p>
          <h1>{unitName}</h1>
        </div>
        <div className="row">
          <span className={connected ? 'online' : 'offline'}>
            {connected ? '● Conectado' : '● Reconectando'}
          </span>
          <button className="secondary" onClick={enableSound}>
            {sound ? 'Som ativado ✓' : 'Ativar som'}
          </button>
          <button
            className="secondary"
            onClick={() => {
              void document.documentElement
                .requestFullscreen?.()
                .catch(() => setError('Tela cheia indisponível.'));
            }}
          >
            Tela cheia
          </button>
        </div>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section
        className="display-call"
        aria-live="polite"
        key={current?.id || 'empty'}
      >
        {current ? (
          <>
            <span className={`badge ${current.service}`}>
              {services[current.service]}
            </span>
            <h2>{code(current.service, current.number)}</h2>
            <p>Dirija-se ao guichê</p>
            <strong className="display-desk">{current.desk_name}</strong>
          </>
        ) : (
          <>
            <h2 className="waiting-title">Aguarde a chamada</h2>
            <p>Sua senha aparecerá aqui.</p>
          </>
        )}
      </section>
      <section className="recent">
        <h2>Últimas chamadas</h2>
        <div className="recent-grid">
          {history.slice(1, 6).map((event) => (
            <article key={event.id}>
              <span className={`badge ${event.service}`}>
                {services[event.service]}
              </span>
              <strong>{code(event.service, event.number)}</strong>
              <span>Guichê {event.desk_name}</span>
            </article>
          ))}
        </div>
      </section>
      <footer>Confira sua senha e aguarde a chamada para o atendimento.</footer>
    </main>
  );
}
