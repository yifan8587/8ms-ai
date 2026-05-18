import { useState } from "react";
import { storeAuthSession } from "@/lib/auth/session-storage";
import { registerWithPassword } from "../../api";
import { mapAuthApiUserToAuthUser } from "../../model";
import { useAuthStore } from "../../store";

export function useAuthRegisterOperation() {
  const [isLoading, setIsLoading] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  async function register(username: string, email: string, password: string) {
    setIsLoading(true);

    try {
      const data = await registerWithPassword(username, email, password);
      const user = mapAuthApiUserToAuthUser(data.user, email);

      // 同时把 Django 完整 user JSON 写入 localStorage.user_info，
      // 让 /console/ Vue admin 直接识别身份，无需二次登录
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
    register,
  };
}
