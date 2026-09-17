import type { Metadata } from 'next';
import './styles.css';
export const metadata: Metadata = {
  title: 'Painel de Senhas',
  description: 'Recepção e chamadas por unidade',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
