import type { AuthApiUser, AuthUser } from "./types";

export function mapAuthApiUserToAuthUser(
  user: AuthApiUser,
  fallbackEmail = "",
): AuthUser {
  return {
    id: String(user.id),
    name: user.nickname || user.username,
    email: user.email || fallbackEmail,
    username: user.username,
    nickname: user.nickname,
  };
}

export function parseStoredAuthUser(value: string | null): AuthUser | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    return null;
  }
}
