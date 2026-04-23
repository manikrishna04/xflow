import { PayoutDetailScreen } from "@/components/screens/payout-detail-screen";

export default async function PayoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <PayoutDetailScreen payoutId={id} />;
}
