import { Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AuthPasswordField } from "./AuthPasswordField";

type LoginPageViewProps = {
  errors: Record<string, string>;
  isLoading: boolean;
  onPasswordBlur: () => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onTogglePasswordVisibility: () => void;
  onUsernameBlur: () => void;
  onUsernameChange: (value: string) => void;
  password: string;
  showPassword: boolean;
  submitError: string;
  t: (key: string) => string;
  username: string;
};

export function LoginPageView({
  errors,
  isLoading,
  onPasswordBlur,
  onPasswordChange,
  onSubmit,
  onTogglePasswordVisibility,
  onUsernameBlur,
  onUsernameChange,
  password,
  showPassword,
  submitError,
  t,
  username,
}: LoginPageViewProps) {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-2xl p-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {t("username")}
              </label>
              <input
                type="text"
                value={username}
                onChange={(event) => onUsernameChange(event.target.value)}
                onBlur={onUsernameBlur}
                placeholder={t("usernamePlaceholder")}
                className="w-full rounded-lg border border-border bg-muted px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {errors.username ? (
                <p className="mt-1 text-xs text-destructive">{errors.username}</p>
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

            {submitError ? (
              <p className="text-sm text-destructive">{submitError}</p>
            ) : null}

            <div className="text-right">
              <span className="cursor-pointer text-sm text-primary hover:underline">
                {t("forgotPassword")}
              </span>
            </div>

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
            {t("noAccount")}{" "}
            <Link
              href="/auth/register"
              className="font-medium text-primary hover:underline"
            >
              {t("goRegister")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
