import { useCallback } from "react";
import { getStoredAuthSession } from "@/lib/auth/session-storage";
import { parseStoredAuthUser } from "../../model";
import { useAuthStore } from "../../store";

export function useAuthHydration() {
  const clearSession = useAuthStore((state) => state.clearSession);
  const setSession = useAuthStore((state) => state.setSession);

  return useCallback(() => {
    const { accessToken, refreshToken, user } = getStoredAuthSession();
    const parsedUser = parseStoredAuthUser(user);

    if (accessToken && parsedUser) {
      setSession({
        user: parsedUser,
        token: accessToken,
        refreshToken,
      });
      return;
    }

    clearSession();
  }, [clearSession, setSession]);
}
