import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Package,
  Plus,
  Settings,
  ShieldCheck,
  Truck,
  Unlock,
  Users,
} from 'lucide-react';
import { useSession } from '../../hooks/useSession.js';
import { useOrders } from '../../hooks/useOrders.js';
import { useNotifications } from '../../hooks/useNotifications.js';
import { formatRelative, shortAddress } from '../../lib/format.js';
import { roleLabel } from '../../shared/personas.js';
import { statusMeta } from '../../lib/status.js';
import { Avatar } from '../ui/Avatar.jsx';
import { Callout } from '../ui/Callout.jsx';
import { Dropdown } from '../ui/Dropdown.jsx';
import { ThemeToggle } from '../ui/ThemeToggle.jsx';

const SECTION_LABELS = [
  ['/dashboard', 'Overview'],
  ['/orders/new', 'New order'],
  ['/orders/', 'Shipment detail'],
  ['/orders', 'Shipments'],
  ['/queue', 'Delivery queue'],
  ['/dispatch', 'Dispatch'],
  ['/team', 'Team'],
  ['/reports', 'Reports'],
  ['/notifications', 'Notifications'],
  ['/settings', 'Settings'],
  ['/privacy', 'Privacy'],
];

function sectionFor(pathname) {
  const match = SECTION_LABELS.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(prefix)
  );
  return match?.[1] ?? 'BlockTrack';
}

function navItemsFor(role) {
  if (role === 'admin') {
    return [
      { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { to: '/orders', label: 'All orders', icon: Package },
      { to: '/dispatch', label: 'Dispatch', icon: Truck },
      { to: '/team', label: 'Team', icon: Users },
      { to: '/reports', label: 'Reports', icon: ShieldCheck },
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/settings', label: 'Settings', icon: Settings },
    ];
  }
  if (role === 'courier') {
    return [
      { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { to: '/queue', label: 'Delivery queue', icon: Truck },
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/settings', label: 'Settings', icon: Settings },
    ];
  }
  return [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/orders', label: 'My orders', icon: Package },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];
}

function Sidebar({ open, onClose, role, name, address, unreadCount, counts }) {
  const items = navItemsFor(role);
  const navigate = useNavigate();

  return (
    <>
      <button
        type="button"
        className="sidebar-backdrop"
        data-open={open}
        aria-label="Close navigation"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <aside className="sidebar" data-open={open} aria-label="Primary">
        <Link to="/dashboard" className="sidebar__brand" onClick={onClose}>
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M4.5 7.4 12 3.6l7.5 3.8v9.2L12 20.4l-7.5-3.8V7.4Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="m4.5 7.4 7.5 3.9 7.5-3.9M12 11.3v9.1"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
                opacity="0.55"
              />
              <circle cx="12" cy="11.3" r="1.45" fill="currentColor" />
            </svg>
          </span>
          <span className="brand-word" translate="no">
            Block<span>Track</span>
          </span>
        </Link>

        {role !== 'courier' ? (
          <div className="sidebar__cta">
            <Link
              to="/orders/new"
              className="btn btn--primary btn--block"
              onClick={onClose}
            >
              <Plus size={15} aria-hidden="true" />
              <span>{role === 'admin' ? 'Register order' : 'New order'}</span>
            </Link>
          </div>
        ) : null}

        <nav className="sidebar__nav" style={{ marginTop: 18 }}>
          {items.map((item) => {
            const Icon = item.icon;
            const count =
              item.to === '/notifications'
                ? unreadCount
                : item.to === '/orders' && role === 'customer'
                  ? counts.active
                  : item.to === '/dispatch'
                    ? counts.unassigned
                    : item.to === '/queue'
                      ? counts.active
                      : 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className="nav-link"
                onClick={onClose}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
                {count > 0 ? (
                  <span className="nav-link__count" aria-label={`${count} items`}>
                    {count > 99 ? '99+' : count}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar__foot">
          <Link
            to="/privacy"
            className="sidebar__privacy"
            onClick={onClose}
            style={{ textDecoration: 'none' }}
          >
            <ShieldCheck size={14} aria-hidden="true" />
            <span>
              Details are encrypted in your browser. <u>How it works</u>
            </span>
          </Link>
          <Link
            to="/settings"
            className="user-card"
            onClick={onClose}
            title={address}
          >
            <Avatar name={name} address={address} size="sm" />
            <span className="user-card__body">
              <span className="user-card__name">{name}</span>
              <span className="user-card__meta">{roleLabel(role)}</span>
            </span>
            <ChevronRight size={14} className="user-card__chev" aria-hidden="true" />
          </Link>
        </div>
      </aside>
    </>
  );
}

function Topbar({
  onMenu,
  notifications,
  address,
  profile,
  wallet,
  vault,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const section = sectionFor(location.pathname);
  const { items, unreadCount, markAllRead } = notifications;

  const switchPersona = async (id) => {
    try {
      await wallet.connectDemo(id);
      navigate('/dashboard');
    } catch {
      // The wallet context surfaces the error on the login surface.
    }
  };

  const displayName = profile?.displayName || wallet.persona?.name || shortAddress(address);

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button
          type="button"
          className="icon-btn mobile-menu-btn"
          aria-label="Open navigation"
          onClick={onMenu}
        >
          <Menu size={18} />
        </button>
        <div className="topbar__crumb">
          <strong>{section}</strong>
        </div>
      </div>

      <div className="topbar__actions">
        <span className="network-chip" title={`Connected to ${wallet.deployment.rpcUrl}`}>
          <span className="dot" aria-hidden="true" />
          Anvil · {wallet.deployment.chainId}
        </span>
        {vault.isUnlocked ? (
          <button
            type="button"
            className="vault-chip vault-chip--open"
            onClick={vault.lock}
            title="Lock the vault and clear decrypted data from memory"
            aria-label="Lock vault"
          >
            <Unlock size={13} aria-hidden="true" />
            Vault open
          </button>
        ) : (
          <span className="vault-chip">
            <Lock size={13} aria-hidden="true" />
            Vault locked
          </span>
        )}
        <ThemeToggle />
        <NotificationBell
          items={items}
          unreadCount={unreadCount}
          markAllRead={markAllRead}
        />
        <Dropdown
          trigger={({ open, toggle }) => (
            <button
              type="button"
              className="topbar-user"
              onClick={toggle}
              aria-expanded={open}
              aria-haspopup="menu"
              aria-label="Account menu"
            >
              <Avatar name={displayName} address={address} size="sm" />
              <ChevronDown size={14} aria-hidden="true" />
            </button>
          )}
          panelClassName="menu"
          panelRole="menu"
          panelLabel="Account menu"
        >
          {({ close }) => (
            <>
              <div className="menu__label">Signed in as</div>
              <div style={{ padding: '0 10px 8px' }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{displayName}</div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
                  {shortAddress(address)}
                </div>
              </div>
              <div className="menu__sep" />
              <Link to="/settings" className="menu__item" onClick={close}>
                <Settings size={15} />
                Settings
              </Link>
              <Link to="/privacy" className="menu__item" onClick={close}>
                <ShieldCheck size={15} />
                How privacy works
              </Link>
              <button
                type="button"
                className="menu__item"
                onClick={() => {
                  close();
                  vault.lock();
                }}
              >
                <Lock size={15} />
                Lock vault
              </button>

              {wallet.demoEnabled ? (
                <>
                  <div className="menu__sep" />
                  <div className="menu__label">Switch demo account</div>
                  <div className="menu__scroll">
                    {wallet.demoPersonas.map((persona) => {
                      const current = wallet.address?.toLowerCase() === persona.address.toLowerCase();
                      return (
                        <button
                          key={persona.id}
                          type="button"
                          className="menu__item"
                          onClick={() => {
                            close();
                            switchPersona(persona.id);
                          }}
                        >
                          <Avatar name={persona.name} address={persona.address} size="sm" />
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block' }}>{persona.name}</span>
                            <span style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-3)' }}>
                              {persona.role === 'admin' ? 'Admin · Operations' : persona.title}
                            </span>
                          </span>
                          {current ? <Check size={14} style={{ marginLeft: 'auto', color: 'var(--green)' }} /> : null}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}

              <div className="menu__sep" />
              <button
                type="button"
                className="menu__item menu__item--danger"
                onClick={() => {
                  close();
                  wallet.disconnect();
                }}
              >
                <LogOut size={15} />
                {wallet.mode === 'demo' ? 'Sign out' : 'Disconnect wallet'}
              </button>
            </>
          )}
        </Dropdown>
      </div>
    </header>
  );
}

function NotificationBell({ items, unreadCount, markAllRead }) {
  return (
    <Dropdown
      trigger={({ open, toggle }) => (
        <button
          type="button"
          className="icon-btn"
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          aria-expanded={open}
          aria-haspopup="true"
          onClick={toggle}
          style={{ position: 'relative' }}
        >
          <Bell size={17} />
          {unreadCount > 0 ? <span className="notif-dot" aria-hidden="true" /> : null}
        </button>
      )}
      panelClassName="notif-popover"
      panelLabel="Notifications"
    >
      {({ close }) => (
        <>
          <div className="notif-popover__head">
            <span className="notif-popover__title">Notifications</span>
            {items.length ? (
              <button type="button" className="btn btn--link" onClick={markAllRead}>
                Mark all read
              </button>
            ) : null}
          </div>
          {items.length ? (
            <div className="notif-popover__list">
              {items.slice(0, 6).map((item) => (
                <Link
                  key={item.key}
                  to={`/orders/${item.orderId}`}
                  className="notif-item"
                  onClick={close}
                >
                  <span className="notif-item__icon">
                    {(() => {
                      const Icon = statusMeta(item.status).icon;
                      return <Icon size={13} aria-hidden="true" />;
                    })()}
                  </span>
                  <span className="notif-item__body">
                    <span className="notif-item__title">{item.title}</span>
                    <span className="notif-item__text">{item.body}</span>
                    <span className="notif-item__time">
                      {formatRelative(item.timestamp)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty empty--sm" style={{ padding: '28px 20px' }}>
              <div className="empty__art" style={{ width: 44, height: 44, marginBottom: 10 }}>
                <Bell size={18} />
              </div>
              <div className="empty__title" style={{ fontSize: 13 }}>
                No activity yet
              </div>
              <p className="empty__text" style={{ marginTop: 4 }}>
                Status changes will appear here.
              </p>
            </div>
          )}
          <div className="notif-popover__foot">
            <Link
              to="/notifications"
              className="btn btn--secondary btn--block btn--sm"
              onClick={close}
            >
              View all notifications
            </Link>
          </div>
        </>
      )}
    </Dropdown>
  );
}

function BottomNav({ role }) {
  const location = useLocation();
  const items =
    role === 'admin'
      ? [
          { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
          { to: '/orders', label: 'Orders', icon: Package },
          { to: '/dispatch', label: 'Dispatch', icon: Truck },
          { to: '/settings', label: 'Settings', icon: Settings },
        ]
      : role === 'courier'
        ? [
            { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
            { to: '/queue', label: 'Queue', icon: Truck },
            { to: '/notifications', label: 'Alerts', icon: Bell },
            { to: '/settings', label: 'Settings', icon: Settings },
          ]
        : [
            { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
            { to: '/orders', label: 'Orders', icon: Package },
            { to: '/orders/new', label: 'New', icon: Plus },
            { to: '/settings', label: 'Settings', icon: Settings },
          ];

  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          item.to === '/dashboard'
            ? location.pathname === '/dashboard'
            : item.to === '/orders'
              ? location.pathname === '/orders' ||
                (location.pathname.startsWith('/orders/') &&
                  location.pathname !== '/orders/new')
              : location.pathname === item.to ||
                location.pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            className="bottom-nav__item"
            aria-current={active ? 'page' : undefined}
          >
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const session = useSession();
  const ordersState = useOrders();
  const notifications = useNotifications(ordersState.orders);
  const { wallet, vault, role, name, profile } = session;
  const counts = useMemo(() => {
    const orders = ordersState.orders;
    return {
      active: orders.filter(
        (order) => order.status !== 'Delivered' && order.status !== 'Cancelled'
      ).length,
      unassigned: orders.filter(
        (order) =>
          order.status !== 'Delivered' &&
          order.status !== 'Cancelled' &&
          (!order.courier ||
            order.courier === '0x0000000000000000000000000000000000000000')
      ).length,
    };
  }, [ordersState.orders]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  return (
    <div className={`app-shell${sidebarOpen ? ' app-shell--menu-open' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role={role}
        name={name}
        address={wallet.address}
        profile={profile}
        unreadCount={notifications.unreadCount}
        counts={counts}
      />
      <div className="app-body">
        <Topbar
          onMenu={() => setSidebarOpen(true)}
          notifications={notifications}
          address={wallet.address}
          profile={profile}
          wallet={wallet}
          vault={vault}
        />
        <main id="main-content" className="content">
          {wallet.isWrongNetwork ? (
            <div style={{ marginBottom: 18 }}>
              <Callout
                tone="warning"
                title={`Wallet is on chain ${wallet.walletChainId}`}
                action={
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={wallet.switchNetwork}
                  >
                    Switch network
                  </button>
                }
              >
                This app runs on chain {wallet.deployment.chainId}. Reads still work, but
                transactions are paused until you switch.
              </Callout>
            </div>
          ) : null}
          {wallet.chainError ? (
            <div style={{ marginBottom: 18 }}>
              <Callout
                tone="danger"
                title="Chain unreachable"
                action={
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={wallet.retryChain}
                    disabled={wallet.chainChecking}
                  >
                    Retry
                  </button>
                }
              >
                {wallet.chainError}
              </Callout>
            </div>
          ) : null}
          <Outlet context={{ session, ordersState, notifications }} />
        </main>
      </div>
      <BottomNav role={role} />
    </div>
  );
}

export { SECTION_LABELS };
