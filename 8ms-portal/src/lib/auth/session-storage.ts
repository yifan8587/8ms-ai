const ACCESS_TOKEN_STORAGE_KEY = "token";
const REFRESH_TOKEN_STORAGE_KEY = "refreshToken";
const USER_STORAGE_KEY = "user";

// ---------------------------------------------------------------------------
// 与 AIprogram/ai-frontend (Vue 管理后台 /console/) 共享的 localStorage key
// 两个应用同源同域 ⇒ localStorage 是共享的，因此只要门户登录时把
// access_token / refresh_token / user_info 也写进去，Vue 端无需任何改动
// 即可识别为已登录，实现“门户登录 → /console/ 不需要二次登录”。
// 退出时同样要把这三个 key 清掉，避免 Vue 端拿到“僵尸 token”。
// ---------------------------------------------------------------------------
const ADMIN_ACCESS_TOKEN_KEY = "access_token";
const ADMIN_REFRESH_TOKEN_KEY = "refresh_token";
const ADMIN_USER_INFO_KEY = "user_info";

export type StoredAuthSession = {
  accessToken: string | null;
  refreshToken: string | null;
  user: string | null;
};

export function getStoredAuthSession(): StoredAuthSession {
  if (typeof window === "undefined") {
    return {
      accessToken: null,
      refreshToken: null,
      user: null,
    };
  }

  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY),
    user: localStorage.getItem(USER_STORAGE_KEY),
  };
}

/**
 * 持久化登录会话。
 *
 * @param accessToken JWT access
 * @param refreshToken JWT refresh
 * @param user 门户内部使用的精简 user JSON（基于 AuthUser）
 * @param adminUserInfo Vue admin 端期望的完整 Django user JSON（含 is_staff
 *        / is_superuser 等字段）。如果传入则一并写到 `user_info` key，让
 *        /console/ 路由守卫识别管理员身份。
 */
export function storeAuthSession(
  accessToken: string,
  refreshToken: string,
  user: string,
  adminUserInfo?: string,
) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  localStorage.setItem(USER_STORAGE_KEY, user);

  // 共享给 /console/（Vue admin）
  localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, refreshToken);
  if (adminUserInfo) {
    localStorage.setItem(ADMIN_USER_INFO_KEY, adminUserInfo);
  }
}

export function updateStoredAccessToken(accessToken: string) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
  localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, accessToken);
}

export function updateStoredTokens(accessToken: string, refreshToken?: string) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
  localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, accessToken);

  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
    localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearStoredAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);

  // 同步清掉 Vue admin 端的 key，避免 /console/ 路由守卫读到旧登录态
  localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
  localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_INFO_KEY);
}
