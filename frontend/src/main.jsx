import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/pages.css';

import { App } from './App.jsx';
import { BootError, BootScreen, SetupPage } from './components/layout/Boot.jsx';
import { ErrorBoundary } from './components/layout/ErrorBoundary.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { WalletProvider } from './context/WalletContext.jsx';
import { VaultProvider } from './context/VaultContext.jsx';
import { DeploymentError, loadDeployment } from './lib/deployment.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      staleTime: 5_000,
    },
  },
});

function Root() {
  const [state, setState] = React.useState({
    status: 'loading',
    deployment: null,
    error: null,
  });

  React.useEffect(() => {
    let cancelled = false;
    loadDeployment()
      .then((deployment) => {
        if (!cancelled) {
          setState({ status: 'ready', deployment, error: null });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: 'error',
          deployment: null,
          error,
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return <BootScreen />;
  }

  if (state.status === 'error') {
    if (state.error instanceof DeploymentError && state.error.missing) {
      return <SetupPage error={state.error.message} />;
    }
    return (
      <BootError
        error={state.error?.message || String(state.error)}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <WalletProvider deployment={state.deployment}>
            <VaultProvider>
              <BrowserRouter>
                <ErrorBoundary>
                  <App deployment={state.deployment} />
                </ErrorBoundary>
              </BrowserRouter>
            </VaultProvider>
          </WalletProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
