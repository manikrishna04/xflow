export async function GET(
  request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await context.params;
  const { proxyXflowMicroservice } = await import("@/lib/xflow/microservice-proxy");
  return proxyXflowMicroservice(request, `/account/${accountId}`);
}
