import { useEffect, useState } from 'react';
import { Loader2, Mail, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../hooks/useModal';
import { useT } from '../../lib/i18n';
import { ERROR_CODE_KEYS } from './auth-errors';
import { PasswordInput } from './PasswordInput';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { t } = useT();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setError(null);
      setPassword('');
    }
  }, [open]);

  const dialogRef = useModal<HTMLDivElement>(open, onClose);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const key = err.code ? ERROR_CODE_KEYS[err.code] : undefined;
        setError(key ? t(key) : err.message);
      } else {
        setError(t('auth.generic_error'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'login' ? t('auth.welcome_back') : t('auth.create_account')}
        tabIndex={-1}
        className="card-surface w-full max-w-md animate-scale-in p-7 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-white">
            {mode === 'login' ? t('auth.welcome_back') : t('auth.create_account')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="text-white/50 transition-colors hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-6 text-sm text-white/50">
          {mode === 'login' ? t('auth.login_sub') : t('auth.register_sub')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.email_placeholder')}
              className="w-full rounded-xl border border-white/15 bg-white/5 py-3 pl-11 pr-4 text-white placeholder-white/40 outline-none transition-all focus:border-white/40 focus:ring-2 focus:ring-white/20"
            />
          </div>
          <PasswordInput
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'register' ? t('auth.password_min') : t('auth.password_placeholder')}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : mode === 'login' ? (
              t('auth.login_btn')
            ) : (
              t('auth.register_btn')
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-white/50">
          {mode === 'login' ? t('auth.no_account') : t('auth.have_account')}{' '}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="font-semibold text-white underline decoration-white/40 underline-offset-4 transition-colors hover:decoration-white"
          >
            {mode === 'login' ? t('auth.signup_link') : t('auth.login_link')}
          </button>
        </p>
      </div>
    </div>
  );
}
