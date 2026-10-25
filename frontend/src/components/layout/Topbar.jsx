import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Boxes,
  ChevronDown,
  LogOut,
  Settings,
  Wallet,
} from 'lucide-react';
import { formatMinor } from '../../utils/currency.js';

export default function Topbar({
  activePage,
  onOpenMenu,
  onNavigate,
  userName,
  businessName,
  onSettings,
  onLogout,
  lowStockItems = [],
  outstandingCreditMinor = 0,
  outstandingSaleCount = 0,
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function closeMenus(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    }

    document.addEventListener('pointerdown', closeMenus);
    return () => document.removeEventListener('pointerdown', closeMenus);
  }, []);

  const lowStockCount = Array.isArray(lowStockItems) ? lowStockItems.length : 0;
  const notificationCount =
    lowStockCount + (outstandingSaleCount > 0 ? 1 : 0);

  const initials = (userName || 'Business User')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function openPage(page) {
    onNavigate?.(page);
    setNotificationsOpen(false);
    setProfileOpen(false);
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="icon-button mobile-menu"
          onClick={onOpenMenu}
          aria-label="Open navigation"
        >
          <span className="menu-icon"><Boxes size={19} /></span>
        </button>

        <div className="breadcrumb">
          Workspace <span>/</span> <strong>{activePage}</strong>
        </div>
      </div>

      <div className="topbar-actions" ref={menuRef}>
        <div className="topbar-menu-wrap">
          <button
            type="button"
            className="icon-button notification-button"
            onClick={() => {
              setNotificationsOpen((value) => !value);
              setProfileOpen(false);
            }}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
          >
            <Bell size={17} />
            {notificationCount > 0 && <span className="notification-dot" />}
          </button>

          {notificationsOpen && (
            <div className="topbar-popover notification-popover">
              <div className="popover-heading">Business notifications</div>

              <button
                type="button"
                className="notification-item"
                onClick={() => openPage('Inventory')}
              >
                <span className="notification-symbol warning">
                  <AlertTriangle size={17} />
                </span>
                <span className="notification-copy">
                  <strong>Low stock</strong>
                  <small>
                    {lowStockCount > 0
                      ? `${lowStockCount} product${lowStockCount === 1 ? '' : 's'} need attention.`
                      : 'No low-stock products reported.'}
                  </small>
                </span>
                <Boxes size={16} />
              </button>

              <button
                type="button"
                className="notification-item"
                onClick={() => openPage('Sales')}
              >
                <span className="notification-symbol credit">
                  <Wallet size={17} />
                </span>
                <span className="notification-copy">
                  <strong>Outstanding credit</strong>
                  <small>
                    {outstandingSaleCount > 0
                      ? `${outstandingSaleCount} sale${outstandingSaleCount === 1 ? '' : 's'} · ${formatMinor(outstandingCreditMinor)}`
                      : 'No outstanding sales reported.'}
                  </small>
                </span>
              </button>
            </div>
          )}
        </div>

        <div className="topbar-menu-wrap">
          <button
            type="button"
            className="top-profile-button"
            onClick={() => {
              setProfileOpen((value) => !value);
              setNotificationsOpen(false);
            }}
            aria-label="Open profile menu"
            aria-expanded={profileOpen}
          >
            <span className="avatar top-avatar">{initials}</span>
            <ChevronDown size={13} className="profile-chevron" />
          </button>

          {profileOpen && (
            <div className="topbar-popover profile-popover">
              <div className="profile-popover-header">
                <span className="avatar profile-popover-avatar">{initials}</span>
                <span className="profile-popover-copy">
                  <strong>{userName || 'Business user'}</strong>
                  <small>{businessName || 'My Business'}</small>
                </span>
              </div>

              <button
                type="button"
                className="profile-menu-item"
                onClick={() => {
                  onSettings?.();
                  setProfileOpen(false);
                }}
              >
                <Settings size={17} /> Settings and profile
              </button>

              <button
                type="button"
                className="profile-menu-item signout-item"
                onClick={() => {
                  setProfileOpen(false);
                  onLogout?.();
                }}
              >
                <LogOut size={17} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
