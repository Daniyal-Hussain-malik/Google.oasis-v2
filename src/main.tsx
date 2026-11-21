import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AdminAuthProvider } from '@/src/context/AdminAuthContext';
import { LanguageProvider } from '@/src/context/I18nContext';
import { AppThemeProvider } from '@/src/context/ThemeContext';
import { initFrontendSentry, Sentry } from '@/src/lib/sentry';
import App from './App.tsx';
import './index.css';

initFrontendSentry();

function CrashFallback({ resetError }: { resetError: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <p className="font-mono text-xs uppercase tracking-wider text-accent">Unexpected Application Error</p>
        <h1 className="font-display text-2xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          The page ran into an unexpected problem. Reload the view or return to the homepage.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={resetError}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 cursor-pointer"
          >
            Try Again
          </button>
          <a
            href="/"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Return Home
          </a>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={({ resetError }) => <CrashFallback resetError={resetError} />}>
      <BrowserRouter>
        <AppThemeProvider>
          <LanguageProvider>
            <AdminAuthProvider>
              <App />
              <Toaster position="top-right" richColors closeButton />
            </AdminAuthProvider>
          </LanguageProvider>
        </AppThemeProvider>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
