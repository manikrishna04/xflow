"use client";

import { useEffect, useEffectEvent } from "react";
import { useRouter } from "next/navigation";

import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";

export function useAuthGuard() {
  const hydrated = useHydrated();
  const isAuthenticated = useTradEdgeStore((state) => state.session.isAuthenticated);
  const router = useRouter();

  const redirectToLogin = useEffectEvent(() => {
    router.replace("/login");
  });

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      redirectToLogin();
    }
  }, [hydrated, isAuthenticated]);

  return {
    hydrated,
    isAuthenticated,
    ready: hydrated && isAuthenticated,
  };
}
