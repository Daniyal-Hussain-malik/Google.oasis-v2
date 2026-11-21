import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AdminAuthProvider } from '@/src/context/AdminAuthContext';
import { LanguageProvider } from '@/src/context/I18nContext';
import { AppThemeProvider } from '@/src/context/ThemeContext';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
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
  </StrictMode>,
);
