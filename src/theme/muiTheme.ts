import { createTheme } from '@mui/material/styles';

export function buildMuiTheme(mode: 'light' | 'dark' = 'light') {
  const isDark = mode === 'dark';
  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#e8943a' : '#132038',
        contrastText: isDark ? '#111b2e' : '#f8f5ee',
      },
      secondary: {
        main: '#d97724',
        contrastText: '#ffffff',
      },
      error: {
        main: isDark ? '#ef4444' : '#b42318',
      },
      success: {
        main: '#15803d',
      },
      warning: {
        main: '#d97706',
      },
      background: {
        default: isDark ? '#0b1220' : '#f8f5ee',
        paper: isDark ? '#111b2e' : '#ffffff',
      },
      text: {
        primary: isDark ? '#f1f5f9' : '#182235',
        secondary: isDark ? '#94a3b8' : '#5a6578',
      },
      divider: isDark ? '#23324d' : '#e3dccd',
    },
    shape: {
      borderRadius: 10,
    },
    typography: {
      fontFamily: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
      h1: { fontFamily: '"Cormorant Garamond", Georgia, serif', fontWeight: 600 },
      h2: { fontFamily: '"Cormorant Garamond", Georgia, serif', fontWeight: 600 },
      h3: { fontFamily: '"Cormorant Garamond", Georgia, serif', fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${isDark ? '#23324d' : '#e3dccd'}`,
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 600,
          },
        },
      },
      MuiTextField: {
        defaultProps: { size: 'small', variant: 'outlined' },
      },
      MuiSelect: {
        defaultProps: { size: 'small' },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            border: 'none',
            borderLeft: `1px solid ${isDark ? '#23324d' : '#e3dccd'}`,
          },
        },
      },
    },
  });
}
