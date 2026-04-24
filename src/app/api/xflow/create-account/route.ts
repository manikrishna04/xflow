import { proxyXflowMicroservice } from "@/lib/xflow/microservice-proxy";

export async function POST(request: Request) {
  return proxyXflowMicroservice(request, "/create-account");
}
