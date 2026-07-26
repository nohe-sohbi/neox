import { useEffect, useState } from 'react';
import { Download, Loader2, LogOut, ShieldCheck, Trash2, X } from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import { backupFilename } from '../../lib/library-io';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useModal } from '../../hooks/useModal';
import { useT } from '../../lib/i18n';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
}

// Backend error codes → i18n keys, so account errors follow the UI language
// instead of the server's hardcoded French.
const ERROR_CODE_KEYS: Record<string, string> = {
  AUTH_CURRENT_PASSWORD_INVALID: 'account.err.current_password',
  AUTH_PASSWORD_TOO_SHORT: 'auth.err.password_short',
  AUTH_ACCOUNT_NOT_FOUND: 'auth.err.account_not_found',
  AUTH_SESSION_INVALID: 'auth.err.session_invalid',
};

const fieldClass =
  'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none transition-all focus:border-white/40 focus:ring-2 focus:ring-white/20';

const sectionClass = 'rounded-2xl border border-white/10 bg-white/5 p-4';

/**
 * Account settings: the surface that turns "an account syncs my list" into "an
 * account is mine". Password rotation, session revocation, a full data export
 * and deletion all live here, so nothing about the account is a one-way door.
 */
export function AccountModal({ open, onClose }: AccountModalProps) {
  const { t } = useT();
  const { user, changePassword, logoutEverywhere, deleteAccount } = useAuth();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState<null | 'password' | 'sessions' | 'export' | 'delete'>(null);
  const [error, setError] = useState<string | null>(null);

  // Never leave a typed password sitting in state behind a closed dialog.
  useEffect(() => {
    if (open) return;
    setCurrentPassword('');
    setNewPassword('');
    setDeletePassword('');
    setConfirmingDelete(false);
    setError(null);
  }, [open]);

  // Losing the account with the panel open (deletion, or a session that expired
  // mid-visit) must close it, not render nothing: the modal's scroll lock and
  // focus trap are released by `onClose`, so a silent early return would leave
  // the page stuck behind an invisible dialog.
  useEffect(() => {
    if (open && !user) onClose();
  }, [open, user, onClose]);

  const dialogRef = useModal<HTMLDivElement>(open, onClose);

  if (!open || !user) return null;

  const fail = (err: unknown) => {
    if (err instanceof ApiError) {
      const key = err.code ? ERROR_CODE_KEYS[err.code] : undefined;
      setError(key ? t(key) : err.message);
    } else {
      setError(t('auth.generic_error'));
    }
  };

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<void>) => {
    setError(null);
    setBusy(kind);
    try {
      await action();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const handlePassword = (e: React.FormEvent) => {
    e.preventDefault();
    void run('password', async () => {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      toast.success(t('account.password_changed'));
    });
  };

  const handleLogoutEverywhere = () =>
    void run('sessions', async () => {
      await logoutEverywhere();
      toast.success(t('account.logout_all_done'));
    });

  const handleExport = () =>
    void run('export', async () => {
      const data = await api.exportAccount();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFilename(new Date(), 'account');
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('toast.exported'));
    });

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    void run('delete', async () => {
      await deleteAccount(deletePassword);
      toast.success(t('account.deleted'));
      onClose();
    });
  };

  const memberSince = new Date(user.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });

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
        className="card-surface max-h-[90vh] w-full max-w-lg animate-scale-in overflow-y-auto p-7 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-4">
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
        <p className="mb-6 truncate text-sm text-white/50">
          {user.email} · {t('account.member_since', { date: memberSince })}
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="space-y-4">
          {/* Password */}
          <form onSubmit={handlePassword} className={sectionClass}>
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-white/60" />
              {t('account.security')}
            </h3>
            <p className="mb-3 text-sm text-white/55">{t('account.security_desc')}</p>
            <div className="space-y-2">
              <input
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('account.current_password')}
                className={fieldClass}
              />
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('account.new_password')}
                className={fieldClass}
              />
            </div>
            <button
              type="submit"
              disabled={busy !== null}
              className="btn-primary mt-3 w-full disabled:opacity-60"
            >
              {busy === 'password' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                t('account.change_password')
              )}
            </button>
          </form>

          {/* Sessions */}
          <div className={sectionClass}>
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
              <LogOut className="h-4 w-4 text-white/60" />
              {t('account.sessions')}
            </h3>
            <p className="mb-3 text-sm text-white/55">{t('account.sessions_desc')}</p>
            <button
              onClick={handleLogoutEverywhere}
              disabled={busy !== null}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-60"
            >
              {busy === 'sessions' ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              ) : (
                t('account.logout_all')
              )}
            </button>
          </div>

          {/* Data */}
          <div className={sectionClass}>
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
              <Download className="h-4 w-4 text-white/60" />
              {t('account.data')}
            </h3>
            <p className="mb-3 text-sm text-white/55">{t('account.data_desc')}</p>
            <button
              onClick={handleExport}
              disabled={busy !== null}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-60"
            >
              {busy === 'export' ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              ) : (
                t('account.export_all')
              )}
            </button>
          </div>

          {/* Deletion */}
          <div className="rounded-2xl border border-red-500/25 bg-red-950/20 p-4">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-red-200">
              <Trash2 className="h-4 w-4" />
              {t('account.danger')}
            </h3>
            <p className="mb-3 text-sm text-white/55">{t('account.delete_desc')}</p>
            {!confirmingDelete ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="w-full rounded-xl border border-red-500/40 px-4 py-2.5 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/15"
              >
                {t('account.delete')}
              </button>
            ) : (
              <form onSubmit={handleDelete} className="space-y-2">
                <input
                  type="password"
                  required
                  autoFocus
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder={t('account.delete_confirm')}
                  className={fieldClass}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingDelete(false);
                      setDeletePassword('');
                    }}
                    className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
                  >
                    {t('account.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={busy !== null}
                    className="flex-1 rounded-xl bg-red-500/90 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
                  >
                    {busy === 'delete' ? (
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    ) : (
                      t('account.delete_cta')
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
