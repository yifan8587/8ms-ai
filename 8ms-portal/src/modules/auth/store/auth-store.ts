import { create } from "zustand";
import type { AuthUser } from "../model";

type AuthStoreState = {
  refreshToken: string | null;
  token: string | null;
  user: AuthUser | null;
  clearSession: () => void;
  setAccessToken: (token: string, refreshToken?: string | null) => void;
  setSession: (session: {
    refreshToken: string | null;
    token: string;
    user: AuthUser;
  }) => void;
};

export const useAuthStore = create<AuthStoreState>((set) => ({
  refreshToken: null,
  token: null,
  user: null,
  clearSession: () =>
    set({
      user: null,
      token: null,
      refreshToken: null,
    }),
  setAccessToken: (token, refreshToken) =>
    set((current) => ({
      token,
      refreshToken: refreshToken ?? current.refreshToken,
    })),
  setSession: ({ refreshToken, token, user }) =>
    set({
      user,
      token,
      refreshToken,
    }),
}));
