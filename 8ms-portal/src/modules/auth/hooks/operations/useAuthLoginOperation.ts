import { useState } from "react";
import { storeAuthSession } from "@/lib/auth/session-storage";
import { loginWithPassword } from "../../api";
import { mapAuthApiUserToAuthUser } from "../../model";
import { useAuthStore } from "../../store";

export function useAuthLoginOperation() {
  const [isLoading, setIsLoading] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  async function login(username: string, password: string) {
    setIsLoading(true);

    try {
      const data = await loginWithPassword(username, password);
      const user = mapAuthApiUserToAuthUser(data.user);

      // 同时把 Django 返回的完整 user 对象（含 is_staff/is_superuser 等字段）
      // 写入 localStorage.user_info，给 /console/ Vue admin 复用
      storeAuthSession(
        data.access,
        data.refresh,
        JSON.stringify(user),
        JSON.stringify(data.user),
      );
      setSession({
        user,
        token: data.access,
        refreshToken: data.refresh,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return {
    isLoading,
    login,
  };
}
