import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Package, Search } from 'lucide-react';
import { useWallet } from '../context/WalletContext.jsx';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { Logo } from '../components/ui/Logo.jsx';

export function NotFoundPage() {
  usePageTitle('Page not found');
  const wallet = useWallet();
  const connected = Boolean(wallet.address && wallet.signer);

  return (
    <div className="setup-page">
      <div className="setup-card" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Logo to="/track" className="public-brand" />
        </div>
        <div className="not-found">
          <span className="not-found__code">Error 404</span>
          <h1>That page doesn&apos;t exist.</h1>
          <p>
            The link may be outdated, or the shipment ID may be wrong. Try the
            public tracker or head back to your workspace.
          </p>
          <div className="empty__actions">
            {connected ? (
              <Link to="/dashboard" className="btn btn--primary">
                <ArrowLeft size={15} aria-hidden="true" />
                Back to dashboard
              </Link>
            ) : (
              <Link to="/login" className="btn btn--primary">
                <ArrowRight size={15} aria-hidden="true" />
                Sign in
              </Link>
            )}
            <Link to="/track" className="btn btn--secondary">
              <Search size={15} aria-hidden="true" />
              Track a shipment
            </Link>
            <Link to="/privacy" className="btn btn--ghost">
              <Package size={15} aria-hidden="true" />
              Privacy model
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
