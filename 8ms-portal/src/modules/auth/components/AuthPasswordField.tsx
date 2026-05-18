import { Eye, EyeOff } from "lucide-react";

type AuthPasswordFieldProps = {
  error?: string;
  label: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
  placeholder: string;
  showPassword: boolean;
  value: string;
};

export function AuthPasswordField({
  error,
  label,
  onBlur,
  onChange,
  onToggleVisibility,
  placeholder,
  showPassword,
  value,
}: AuthPasswordFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-muted px-4 py-3 pr-10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
