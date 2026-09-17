export const services = { FAM: 'Família', CRI: 'Criminal', TRI: 'Triagem', IDE: 'Inicial Defesa' } as const;
export type Service = keyof typeof services;
export function code(service: string, number: number) { return `${service}-${String(number).padStart(3, '0')}`; }
export function validCpf(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let length = 9; length <= 10; length++) {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const digit = (sum * 10) % 11;
    if ((digit === 10 ? 0 : digit) !== Number(cpf[length])) return false;
  }
  return true;
}
export function age(birth: string, today: string) {
  return Number(today.slice(0, 4)) - Number(birth.slice(0, 4)) - (today.slice(5) < birth.slice(5) ? 1 : 0);
}
export class AppError extends Error { constructor(message: string, public status = 400) { super(message); } }
