import { proxyXflowMicroservice } from "@/lib/xflow/microservice-proxy";

export async function GET(request: Request) {
  return proxyXflowMicroservice(request, "/purpose-codes");
}
