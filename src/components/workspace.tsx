'use client';
import { useEffect, useState } from 'react';
import { api, type Unit } from './client';
import Reception from './reception';
import Desk from './desk';
import Configuration from './configuration';
export default function Workspace({
  user,
}: {
  user: { id: string; name: string };
}) {
  const [tab, setTab] = useState('reception');
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState('');
  const [error, setError] = useState('');
  async function load() {
    try {
      const units = await api<Unit[]>('/units');
      setUnits(units);
      setUnitId((id) =>
        units.some((u) => u.id === id) ? id : units[0]?.id || '',
      );
      setError('');
    } catch (error) {
      setError((error as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const unit = units.find((u) => u.id === unitId);
  return (
    <>
      <header className="topbar">
        <div className="brand">◉ Painel de Senhas</div>
        <div className="row">
          <span>{user.name}</span>
          <button
            className="ghost"
            onClick={async () => {
              try {
                await api('/logout', {});
                window.location.href = '/login';
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Sair
          </button>
        </div>
      </header>
      <main className="workspace">
        <div className="page-heading">
          <div>
            <p className="eyebrow">ATENDIMENTO · GESTÃO DE FILAS</p>
            <h1>
              {tab === 'reception'
                ? 'Recepção'
                : tab === 'desk'
                  ? 'Guichê de atendimento'
                  : 'Configurações'}
            </h1>
          </div>
          <label className="unit-select">
            Unidade de trabalho
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="" disabled>
                Selecione uma unidade
              </option>
              {units.map((u) => (
                <option value={u.id} key={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <nav className="tabs" aria-label="Área de trabalho">
          {[
            ['reception', 'Recepção'],
            ['desk', 'Guichê'],
            ['configuration', 'Configurações'],
          ].map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? 'selected' : 'ghost'}
              onClick={() => {
                setTab(id);
                void load();
              }}
            >
              {label}
            </button>
          ))}
          {unit && (
            <a href={`/painel/${unit.id}`} target="_blank" rel="noreferrer">
              Abrir painel ↗
            </a>
          )}
        </nav>
        {error && (
          <p className="error" role="alert">
            {error} <button onClick={load}>Tentar novamente</button>
          </p>
        )}
        {tab === 'configuration' ? (
          <Configuration onChange={load} />
        ) : unit ? (
          tab === 'reception' ? (
            <Reception key={unit.id} unit={unit} />
          ) : (
            <Desk key={unit.id} unit={unit} />
          )
        ) : (
          <section className="card empty">
            <h2>Nenhuma unidade disponível</h2>
            <p>
              Cadastre uma unidade em Configurações ou vincule seu usuário a uma
              unidade existente.
            </p>
            <button onClick={() => setTab('configuration')}>
              Abrir configurações
            </button>
          </section>
        )}
      </main>
    </>
  );
}
