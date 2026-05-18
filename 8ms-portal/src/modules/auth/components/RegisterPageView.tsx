import { Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AuthPasswordField } from "./AuthPasswordField";

type RegisterPageViewProps = {
  agreed: boolean;
  confirmPassword: string;
  email: string;
  errors: Record<string, string>;
  isLoading: boolean;
  name: string;
  onAgreedChange: (value: boolean) => void;
  onConfirmPasswordBlur: () => void;
  onConfirmPasswordChange: (value: string) => void;
  onEmailBlur: () => void;
  onEmailChange: (value: string) => void;
  onNameBlur: () => void;
  onNameChange: (value: string) => void;
  onPasswordBlur: () => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onTogglePasswordVisibility: () => void;
  password: string;
  showPassword: boolean;
  submitError: string;
  t: (key: string) => string;
};

export function RegisterPageView({
  agreed,
  confirmPassword,
  email,
  errors,
  isLoading,
  name,
  onAgreedChange,
  onConfirmPasswordBlur,
  onConfirmPasswordChange,
  onEmailBlur,
  onEmailChange,
  onNameBlur,
  onNameChange,
  onPasswordBlur,
  onPasswordChange,
  onSubmit,
  onTogglePasswordVisibility,
  password,
  showPassword,
  submitError,
  t,
}: RegisterPageViewProps) {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-2xl p-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium">{t("name")}</label>
              <input
                type="text"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                onBlur={onNameBlur}
                placeholder={t("namePlaceholder")}
                className="w-full rounded-lg border border-border bg-muted px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {errors.name ? (
                <p className="mt-1 text-xs text-destructive">{errors.name}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">{t("email")}</label>
              <input
                type="email"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                onBlur={onEmailBlur}
                placeholder={t("emailPlaceholder")}
                className="w-full rounded-lg border border-border bg-muted px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {errors.email ? (
                <p className="mt-1 text-xs text-destructive">{errors.email}</p>
              ) : null}
            </div>

            <AuthPasswordField
              error={errors.password}
              label={t("password")}
              onBlur={onPasswordBlur}
              onChange={onPasswordChange}
              onToggleVisibility={onTogglePasswordVisibility}
              placeholder={t("passwordPlaceholder")}
              showPassword={showPassword}
              value={password}
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {t("confirmPassword")}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => onConfirmPasswordChange(event.target.value)}
                onBlur={onConfirmPasswordBlur}
                placeholder={t("confirmPasswordPlaceholder")}
                className="w-full rounded-lg border border-border bg-muted px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {errors.confirmPassword ? (
                <p className="mt-1 text-xs text-destructive">
                  {errors.confirmPassword}
                </p>
              ) : null}
            </div>

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => onAgreedChange(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border bg-muted"
              />
              <span className="text-sm text-muted-foreground">
                {t("agree")}{" "}
                <span className="cursor-pointer text-primary hover:underline">
                  {t("terms")}
                </span>{" "}
                {t("and")}{" "}
                <span className="cursor-pointer text-primary hover:underline">
                  {t("privacy")}
                </span>
              </span>
            </div>
            {errors.agreed ? (
              <p className="text-xs text-destructive">{errors.agreed}</p>
            ) : null}

            {submitError ? (
              <p className="text-sm text-destructive">{submitError}</p>
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("submit")}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("hasAccount")}{" "}
            <Link
              href="/auth/login"
              className="font-medium text-primary hover:underline"
            >
              {t("goLogin")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
