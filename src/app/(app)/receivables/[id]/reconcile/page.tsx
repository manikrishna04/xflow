import { ReceivableReconcileScreen } from "@/components/screens/receivable-reconcile-screen";

export default async function ReceivableReconcilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ReceivableReconcileScreen invoiceId={id} />;
}
