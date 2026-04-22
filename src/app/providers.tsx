"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "react-hot-toast";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4_000,
          style: {
            borderRadius: "16px",
            border: "1px solid rgba(19,33,68,0.08)",
            padding: "12px 16px",
            background: "rgba(255,255,255,0.96)",
            color: "#132144",
            boxShadow: "0 18px 40px rgba(19,33,68,0.12)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
