import { BuyerInvoiceScreen } from "@/components/screens/buyer-invoice-screen";

export default async function BuyerPayPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;

  return <BuyerInvoiceScreen invoiceId={invoiceId} />;
}
