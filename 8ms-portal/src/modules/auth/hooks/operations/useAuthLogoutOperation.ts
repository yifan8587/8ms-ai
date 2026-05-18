import { useCallback } from "react";
import { clearStoredAuthSession } from "@/lib/auth/session-storage";
import { useAuthStore } from "../../store";

export function useAuthLogoutOperation() {
  const clearSession = useAuthStore((state) => state.clearSession);

  return useCallback(() => {
    clearStoredAuthSession();
    clearSession();
  }, [clearSession]);
}
