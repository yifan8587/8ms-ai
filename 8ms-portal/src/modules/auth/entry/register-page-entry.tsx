"use client";

import { RegisterPageView } from "../components";
import { useRegisterPage } from "../hooks";

export function RegisterPageEntry() {
  const registerPage = useRegisterPage();

  return (
    <RegisterPageView
      agreed={registerPage.agreed}
      confirmPassword={registerPage.confirmPassword}
      email={registerPage.email}
      errors={registerPage.errors}
      isLoading={registerPage.isLoading}
      name={registerPage.name}
      onAgreedChange={registerPage.handleAgreedChange}
      onConfirmPasswordBlur={registerPage.handleConfirmPasswordBlur}
      onConfirmPasswordChange={registerPage.handleConfirmPasswordChange}
      onEmailBlur={registerPage.handleEmailBlur}
      onEmailChange={registerPage.handleEmailChange}
      onNameBlur={registerPage.handleNameBlur}
      onNameChange={registerPage.handleNameChange}
      onPasswordBlur={registerPage.handlePasswordBlur}
      onPasswordChange={registerPage.handlePasswordChange}
      onSubmit={registerPage.handleSubmit}
      onTogglePasswordVisibility={registerPage.togglePasswordVisibility}
      password={registerPage.password}
      showPassword={registerPage.showPassword}
      submitError={registerPage.submitError}
      t={registerPage.t}
    />
  );
}
