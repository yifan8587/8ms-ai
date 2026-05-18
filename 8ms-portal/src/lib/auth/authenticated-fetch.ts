import {
  clearStoredAuthSession,
  getStoredAuthSession,
  updateStoredTokens,
} from "./session-storage";
import { refreshAccessToken } from "@/modules/auth/api";

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const { accessToken, refreshToken } = getStoredAuthSession();
  const headers = new Headers(init.headers);

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (response.status !== 401 || !refreshToken) {
    return response;
  }

  try {
    const refreshed = await refreshAccessToken(refreshToken);
    updateStoredTokens(refreshed.access, refreshed.refresh);

    const retryHeaders = new Headers(init.headers);
    retryHeaders.set("Authorization", `Bearer ${refreshed.access}`);

    return fetch(input, {
      ...init,
      headers: retryHeaders,
    });
  } catch {
    clearStoredAuthSession();
    return response;
  }
}
