import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { redirectAfterAuth } from "@/lib/auth/post-auth-redirect";
import { useAuthLoginOperation } from "../operations/useAuthLoginOperation";

export function useLoginPage() {
  const t = useTranslations("auth.login");
  const te = useTranslations("auth.errors");
  const router = useRouter();
  const { isLoading, login } = useAuthLoginOperation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");

  function validateUsername(value: string) {
    const trimmedValue = value.trim();
    if (!trimmedValue) return te("usernameRequired");
    if (trimmedValue.length < 3) return te("usernameMin");
    return "";
  }

  function validatePassword(value: string) {
    if (!value) return te("passwordRequired");
    return "";
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    const usernameError = validateUsername(username);
    const passwordError = validatePassword(password);

    if (usernameError) nextErrors.username = usernameError;
    if (passwordError) nextErrors.password = passwordError;

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleUsernameChange(value: string) {
    setUsername(value);
    setSubmitError("");
    setErrors((current) => ({ ...current, username: "" }));
  }

  function handleUsernameBlur() {
    setErrors((current) => ({
      ...current,
      username: validateUsername(username),
    }));
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    setSubmitError("");
    setErrors((current) => ({ ...current, password: "" }));
  }

  function handlePasswordBlur() {
    setErrors((current) => ({
      ...current,
      password: validatePassword(password),
    }));
  }

  function togglePasswordVisibility() {
    setShowPassword((current) => !current);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    setSubmitError("");

    try {
      await login(username.trim(), password);
      // 默认硬跳转到 /console/（Vue 管理后台），让用户登录后直接进入工作区。
      // 跳转目标来自 NEXT_PUBLIC_POST_LOGIN_REDIRECT，没有配置时取 /console/。
      // 设置成 "/" 可以保留旧行为：登录后停留在门户首页。
      // /console/ 由 nginx 反向代理到独立的 Vue 服务，所以必须做硬跳转，
      // 不能用 router.push（next 路由表里没有 /console/）。
      redirectAfterAuth({ fallbackRouter: () => router.push("/") });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : te("unknown"));
    }
  }

  return {
    errors,
    handlePasswordBlur,
    handlePasswordChange,
    handleSubmit,
    handleUsernameBlur,
    handleUsernameChange,
    isLoading,
    password,
    showPassword,
    submitError,
    t,
    togglePasswordVisibility,
    username,
  };
}
