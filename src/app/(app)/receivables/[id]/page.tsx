import { ReceivableDetailScreen } from "@/components/screens/receivable-detail-screen";

export default async function ReceivableDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ReceivableDetailScreen invoiceId={id} />;
}
