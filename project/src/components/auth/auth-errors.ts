// Backend error codes → i18n keys, so auth errors follow the UI language
// instead of the server's hardcoded French. Unknown codes fall back to the
// (localized) server message, then to a generic error. Shared by the sign-in
// and account modals.
export const ERROR_CODE_KEYS: Record<string, string> = {
  AUTH_EMAIL_INVALID: 'auth.err.email_invalid',
  AUTH_PASSWORD_TOO_SHORT: 'auth.err.password_short',
  AUTH_EMAIL_TAKEN: 'auth.err.email_taken',
  AUTH_CREDENTIALS_REQUIRED: 'auth.err.credentials_required',
  AUTH_INVALID_CREDENTIALS: 'auth.err.invalid_credentials',
  AUTH_ACCOUNT_NOT_FOUND: 'auth.err.account_not_found',
  AUTH_REQUIRED: 'auth.err.required',
  AUTH_SESSION_INVALID: 'auth.err.session_invalid',
};
