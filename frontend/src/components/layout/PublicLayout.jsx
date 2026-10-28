import { Link, NavLink, Outlet } from 'react-router-dom';
import { useWallet } from '../../context/WalletContext.jsx';
import { LinkButton } from '../ui/Button.jsx';
import { Logo } from '../ui/Logo.jsx';
import { ThemeToggle } from '../ui/ThemeToggle.jsx';

export function PublicLayout() {
  const wallet = useWallet();
  const connected = Boolean(wallet.address && wallet.signer);

  return (
    <div className="public-shell">
      <header className="public-header">
        <div className="public-header__inner">
          <Logo to="/track" className="public-brand" size={28} />
          <nav className="public-nav" aria-label="Public">
            <NavLink
              to="/track"
              className={({ isActive }) =>
                `public-nav__link${isActive ? ' public-nav__link--active' : ''}`
              }
            >
              Track
            </NavLink>
            <NavLink
              to="/privacy"
              className={({ isActive }) =>
                `public-nav__link${isActive ? ' public-nav__link--active' : ''}`
              }
            >
              How privacy works
            </NavLink>
            <ThemeToggle />
            <LinkButton
              to={connected ? '/dashboard' : '/login'}
              variant={connected ? 'primary' : 'secondary'}
              size="sm"
            >
              {connected ? 'Open app' : 'Sign in'}
            </LinkButton>
          </nav>
        </div>
      </header>

      <Outlet />

      <footer className="public-footer">
        <div className="public-footer__inner">
          <span>
            BlockTrack · encrypted in your browser · chain {wallet.deployment.chainId}
          </span>
          <span>
            <Link to="/privacy">Privacy model</Link>
            <span aria-hidden="true"> · </span>
            <Link to="/track">Track a shipment</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
