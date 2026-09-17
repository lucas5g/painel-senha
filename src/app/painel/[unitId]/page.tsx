import Panel from '@/components/panel';
export default async function PanelPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  return <Panel unitId={(await params).unitId} />;
}
