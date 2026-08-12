import { useEffect, useState } from 'react';
import { KeyRound, Loader2, Trash2, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useModal } from '../../hooks/useModal';
import { useT } from '../../lib/i18n';
import { ERROR_CODE_KEYS } from './auth-errors';
import { PasswordInput } from './PasswordInput';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Account management: change the password, or delete the account entirely.
 * Both actions re-confirm with a password, and both surface backend error
 * codes through the same localized map as the sign-in modal.
 */
export function AccountModal({ open, onClose }: AccountModalProps) {
  const { t } = useT();
  const { user, changePassword, deleteAccount } = useAuth();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'change' | 'delete' | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setCurrentPassword('');
      setNewPassword('');
      setDeletePassword('');
    }
  }, [open]);

  const dialogRef = useModal<HTMLDivElement>(open, onClose);

  if (!open || !user) return null;

  const showError = (err: unknown) => {
    if (err instanceof ApiError) {
      const key = err.code ? ERROR_CODE_KEYS[err.code] : undefined;
      setError(key ? t(key) : err.message);
    } else {
      setError(t('auth.generic_error'));
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy('change');
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      toast.success(t('toast.password_changed'));
    } catch (err) {
      showError(err);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm(t('account.delete_confirm'))) return;
    setError(null);
    setBusy('delete');
    try {
      await deleteAccount(deletePassword);
      toast.success(t('toast.account_deleted'));
      onClose();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(null);
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
        aria-label={t('account.title')}
        tabIndex={-1}
        className="card-surface w-full max-w-md animate-scale-in p-7 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-white">
            {t('account.title')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="text-white/50 transition-colors hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-6 truncate text-sm text-white/50">{user.email}</p>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">
            {t('account.change_password')}
          </h3>
          <PasswordInput
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={t('account.current_password')}
          />
          <PasswordInput
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t('account.new_password')}
            leftIcon={<KeyRound className="h-5 w-5" />}
          />
          <button type="submit" disabled={busy !== null} className="btn-primary w-full">
            {busy === 'change' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              t('account.change_submit')
            )}
          </button>
        </form>

        <form
          onSubmit={handleDelete}
          className="mt-7 space-y-4 border-t border-white/10 pt-6"
        >
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-red-400/90">
              {t('account.danger_title')}
            </h3>
            <p className="mt-1 text-sm text-white/50">{t('account.delete_desc')}</p>
          </div>
          <PasswordInput
            required
            autoComplete="current-password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder={t('account.delete_password')}
          />
          <button
            type="submit"
            disabled={busy !== null}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-900/20 px-5 py-3 font-semibold text-red-300 transition-colors hover:bg-red-900/40 disabled:opacity-60"
          >
            {busy === 'delete' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Trash2 className="h-5 w-5" />
                {t('account.delete_submit')}
              </>
            )}
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
