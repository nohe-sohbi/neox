import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useT } from '../../lib/i18n';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Replaces the default lock icon on the left. */
  leftIcon?: ReactNode;
}

/**
 * Password field with a show/hide toggle. Typing a password blind is a top
 * cause of failed logins; whether to reveal it is the user's call to make.
 * Shared by the sign-in and account modals so the affordance looks and
 * behaves the same everywhere.
 */
export function PasswordInput({ leftIcon, ...inputProps }: PasswordInputProps) {
  const { t } = useT();
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
        {leftIcon ?? <Lock className="h-5 w-5" />}
      </span>
      <input
        {...inputProps}
        type={visible ? 'text' : 'password'}
        className="w-full rounded-xl border border-white/15 bg-white/5 py-3 pl-11 pr-12 text-white placeholder-white/40 outline-none transition-all focus:border-white/40 focus:ring-2 focus:ring-white/20"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('auth.hide_password') : t('auth.show_password')}
        aria-pressed={visible}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-white"
      >
        {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}
