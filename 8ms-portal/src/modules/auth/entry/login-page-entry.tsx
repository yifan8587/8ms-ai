"use client";

import { LoginPageView } from "../components";
import { useLoginPage } from "../hooks";

export function LoginPageEntry() {
  const loginPage = useLoginPage();

  return (
    <LoginPageView
      errors={loginPage.errors}
      isLoading={loginPage.isLoading}
      onPasswordBlur={loginPage.handlePasswordBlur}
      onPasswordChange={loginPage.handlePasswordChange}
      onSubmit={loginPage.handleSubmit}
      onTogglePasswordVisibility={loginPage.togglePasswordVisibility}
      onUsernameBlur={loginPage.handleUsernameBlur}
      onUsernameChange={loginPage.handleUsernameChange}
      password={loginPage.password}
      showPassword={loginPage.showPassword}
      submitError={loginPage.submitError}
      t={loginPage.t}
      username={loginPage.username}
    />
  );
}
