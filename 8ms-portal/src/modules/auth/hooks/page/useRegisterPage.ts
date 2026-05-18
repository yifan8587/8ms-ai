import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { redirectAfterAuth } from "@/lib/auth/post-auth-redirect";
import { useAuthRegisterOperation } from "../operations/useAuthRegisterOperation";

export function useRegisterPage() {
  const t = useTranslations("auth.register");
  const te = useTranslations("auth.errors");
  const router = useRouter();
  const { isLoading, register } = useAuthRegisterOperation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");

  function validateName(value: string) {
    const trimmedValue = value.trim();
    if (!trimmedValue) return te("nameRequired");
    if (trimmedValue.length < 3) return te("usernameMin");
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedValue)) return te("usernameFormat");
    return "";
  }

  function validateEmail(value: string) {
    const trimmedValue = value.trim();
    if (!trimmedValue) return te("emailRequired");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) {
      return te("emailInvalid");
    }
    return "";
  }

  function validatePassword(value: string) {
    if (!value) return te("passwordRequired");
    if (value.length < 8) return te("passwordMin");
    if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
      return te("passwordFormat");
    }
    return "";
  }

  function validateConfirmPassword(value: string, sourcePassword: string) {
    if (!value) return te("confirmPasswordRequired");
    if (value !== sourcePassword) return te("passwordMismatch");
    return "";
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    const nameError = validateName(name);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const confirmPasswordError = validateConfirmPassword(confirmPassword, password);

    if (nameError) nextErrors.name = nameError;
    if (emailError) nextErrors.email = emailError;
    if (passwordError) nextErrors.password = passwordError;
    if (confirmPasswordError) nextErrors.confirmPassword = confirmPasswordError;
    if (!agreed) nextErrors.agreed = te("agreeRequired");

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleNameChange(value: string) {
    setName(value);
    setSubmitError("");
    setErrors((current) => ({ ...current, name: "" }));
  }

  function handleNameBlur() {
    setErrors((current) => ({
      ...current,
      name: validateName(name),
    }));
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    setSubmitError("");
    setErrors((current) => ({ ...current, email: "" }));
  }

  function handleEmailBlur() {
    setErrors((current) => ({
      ...current,
      email: validateEmail(email),
    }));
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    setSubmitError("");
    setErrors((current) => ({
      ...current,
      password: "",
      confirmPassword:
        confirmPassword && confirmPassword !== value
          ? te("passwordMismatch")
          : "",
    }));
  }

  function handlePasswordBlur() {
    setErrors((current) => ({
      ...current,
      password: validatePassword(password),
    }));
  }

  function handleConfirmPasswordChange(value: string) {
    setConfirmPassword(value);
    setSubmitError("");
    setErrors((current) => ({ ...current, confirmPassword: "" }));
  }

  function handleConfirmPasswordBlur() {
    setErrors((current) => ({
      ...current,
      confirmPassword: validateConfirmPassword(confirmPassword, password),
    }));
  }

  function handleAgreedChange(value: boolean) {
    setAgreed(value);
    setErrors((current) => ({ ...current, agreed: "" }));
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
      await register(name.trim(), email.trim(), password);
      // 同登录页：默认硬跳转到 /console/（NEXT_PUBLIC_POST_LOGIN_REDIRECT 可改）
      redirectAfterAuth({ fallbackRouter: () => router.push("/") });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : te("unknown"));
    }
  }

  return {
    agreed,
    confirmPassword,
    email,
    errors,
    handleAgreedChange,
    handleConfirmPasswordBlur,
    handleConfirmPasswordChange,
    handleEmailBlur,
    handleEmailChange,
    handleNameBlur,
    handleNameChange,
    handlePasswordBlur,
    handlePasswordChange,
    handleSubmit,
    isLoading,
    name,
    password,
    showPassword,
    submitError,
    t,
    togglePasswordVisibility,
  };
}
