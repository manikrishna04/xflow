import { InvoiceDetailScreen } from "@/components/screens/invoice-detail-screen";

export default async function ReceivableDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <InvoiceDetailScreen basePath="/receivables" invoiceId={id} variant="receivable" />;
}
