export function requestId() {
  // getRandomValues also works on HTTP LAN origins, unlike randomUUID.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function api<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  }).catch(() => {
    throw new Error(
      'Sem resposta do servidor. Confira a conexão e tente novamente.',
    );
  });
  const data = await response.json().catch(() => {
    throw new Error('Resposta inválida do servidor. Tente novamente.');
  });
  if (!response.ok) {
    if (response.status === 401 && path !== '/login')
      window.location.href = '/login';
    throw new Error(data.error || 'Não foi possível concluir a operação.');
  }
  return data;
}
export type Unit = {
  id: string;
  name: string;
  timezone: string;
  today: string;
  active?: boolean;
};
export type Ticket = {
  id: string;
  service: string;
  number: number;
  issued_at: string;
  unitName: string;
  timezone: string;
  day: string;
};
export type Person = {
  id: string;
  name: string;
  cpf: string | null;
  birth_date: string;
};
