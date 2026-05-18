import { useState } from "react";
import {
  clearStoredAuthSession,
  getStoredAuthSession,
  updateStoredTokens,
} from "@/lib/auth/session-storage";
import { refreshAccessToken } from "../../api";
import { useAuthStore } from "../../store";

export function useAuthRefreshSessionOperation() {
  const [isLoading, setIsLoading] = useState(false);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);

  async function refreshSession() {
    const { refreshToken } = getStoredAuthSession();

    if (!refreshToken) {
      return null;
    }

    setIsLoading(true);

    try {
      const data = await refreshAccessToken(refreshToken);
      updateStoredTokens(data.access, data.refresh);
      setAccessToken(data.access, data.refresh ?? refreshToken);
      return data.access;
    } catch {
      clearStoredAuthSession();
      clearSession();
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  return {
    isLoading,
    refreshSession,
  };
}
