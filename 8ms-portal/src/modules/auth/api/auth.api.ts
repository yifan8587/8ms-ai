import { getApiBaseUrl } from "@/lib/api/base-url";
import type { AuthApiPayload, RefreshTokenPayload } from "../model";

type ApiEnvelope<T> = {
  code?: number;
  data?: T;
  message?: string;
  msg?: string;
};

async function parseApiResponse<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok) {
    const message =
      json?.msg ??
      json?.message ??
      (typeof json?.data === "string" ? json.data : null) ??
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (
    json &&
    typeof json === "object" &&
    "data" in json &&
    json.data !== undefined
  ) {
    return json.data;
  }

  return json as T;
}

export async function loginWithPassword(username: string, password: string) {
  const response = await fetch(`${getApiBaseUrl()}/users/login/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  return parseApiResponse<AuthApiPayload>(response);
}

export async function registerWithPassword(
  username: string,
  email: string,
  password: string,
) {
  const response = await fetch(`${getApiBaseUrl()}/users/register/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      email,
      nickname: username,
      password,
      password2: password,
    }),
  });

  return parseApiResponse<AuthApiPayload>(response);
}

export async function refreshAccessToken(refresh: string) {
  const response = await fetch(`${getApiBaseUrl()}/users/token/refresh/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh }),
  });

  return parseApiResponse<RefreshTokenPayload>(response);
}
