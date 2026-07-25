import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { t } from '../../lib/i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render-time crashes anywhere below it and shows a friendly, localized
 * fallback instead of a blank white screen: the app shell (navbar/footer) stays
 * usable and the user can recover with a reload. Class component because error
 * boundaries have no hook equivalent; `t` is the resolved i18n singleton.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Surface in dev tools / monitoring; never leak details to the UI.
    console.error('NEOX render error:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-24 text-center"
      >
        <AlertTriangle className="h-12 w-12 text-orange-400" />
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">{t('error.title')}</h1>
          <p className="mt-1 max-w-md text-sm text-white/50">{t('error.boundary_desc')}</p>
        </div>
        <button onClick={this.handleReload} className="btn-primary">
          {t('error.reload')}
        </button>
      </div>
    );
  }
}
