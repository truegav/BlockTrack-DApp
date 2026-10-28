import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import { useEffect } from 'react';
import { useWallet } from './context/WalletContext.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import {
  RequireProfile,
  RequireRole,
  RequireVault,
  RequireWallet,
} from './components/layout/Guards.jsx';
import { PublicLayout } from './components/layout/PublicLayout.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { DispatchPage } from './pages/DispatchPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { NewOrderPage } from './pages/NewOrderPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { NotificationsPage } from './pages/NotificationsPage.jsx';
import { OrderDetailPage } from './pages/OrderDetailPage.jsx';
import { OrdersPage } from './pages/OrdersPage.jsx';
import { PrivacyPage } from './pages/PrivacyPage.jsx';
import { PublicTrackPage } from './pages/PublicTrackPage.jsx';
import { QueuePage } from './pages/QueuePage.jsx';
import { ReportsPage } from './pages/ReportsPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { TeamPage } from './pages/TeamPage.jsx';

function RootRedirect() {
  const wallet = useWallet();
  return (
    <Navigate to={wallet.address && wallet.signer ? '/dashboard' : '/login'} replace />
  );
}

function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType !== 'POP') {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, navigationType]);

  return null;
}

export function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<PublicLayout />}>
          <Route path="/track" element={<PublicTrackPage />} />
          <Route path="/track/:id" element={<PublicTrackPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
        </Route>

        <Route element={<RequireWallet />}>
          <Route element={<RequireVault />}>
            <Route element={<RequireProfile />}>
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<DashboardPage />} />

                <Route element={<RequireRole allow={['customer', 'admin']} />}>
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/orders/new" element={<NewOrderPage />} />
                </Route>

                <Route path="/orders/:id" element={<OrderDetailPage />} />

                <Route element={<RequireRole allow={['courier']} />}>
                  <Route path="/queue" element={<QueuePage />} />
                </Route>

                <Route element={<RequireRole allow={['admin']} />}>
                  <Route path="/dispatch" element={<DispatchPage />} />
                  <Route path="/team" element={<TeamPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                </Route>

                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
