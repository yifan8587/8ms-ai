"use client";

import { useMemo } from "react";
import { useAuthStore as useAuthSessionStore } from "@/modules/auth/store";
import {
  useAuthHydration,
  useAuthLoginOperation,
  useAuthLogoutOperation,
  useAuthRefreshSessionOperation,
  useAuthRegisterOperation,
} from "@/modules/auth/hooks";
import type { AuthUser } from "@/modules/auth/model";

type LegacyAuthStore = {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  refreshSession: () => Promise<string | null>;
  logout: () => void;
  hydrate: () => void;
};

export function useAuthStore(): LegacyAuthStore {
  const user = useAuthSessionStore((state) => state.user);
  const token = useAuthSessionStore((state) => state.token);
  const refreshToken = useAuthSessionStore((state) => state.refreshToken);
  const hydrate = useAuthHydration();
  const logout = useAuthLogoutOperation();
  const { isLoading: isLoginLoading, login } = useAuthLoginOperation();
  const { isLoading: isRegisterLoading, register } = useAuthRegisterOperation();
  const {
    isLoading: isRefreshLoading,
    refreshSession,
  } = useAuthRefreshSessionOperation();

  return useMemo(
    () => ({
      user,
      token,
      refreshToken,
      isLoading: isLoginLoading || isRegisterLoading || isRefreshLoading,
      login,
      register,
      refreshSession,
      logout,
      hydrate,
    }),
    [
      hydrate,
      isLoginLoading,
      isRefreshLoading,
      isRegisterLoading,
      login,
      logout,
      refreshSession,
      refreshToken,
      register,
      token,
      user,
    ],
  );
}
