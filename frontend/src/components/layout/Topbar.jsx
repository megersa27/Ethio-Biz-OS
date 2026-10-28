import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import LanguageSwitcher from './LanguageSwitcher.jsx';

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
  const { t } = useTranslation();
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

  const fallbackName = t('topbar.businessUser');
  const initials = (userName || fallbackName)
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const breadcrumbLabel = t(`nav.${activePage}`, { defaultValue: activePage });

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
          aria-label={t('topbar.openNav')}
        >
          <span className="menu-icon"><Boxes size={19} /></span>
        </button>

        <div className="breadcrumb">
          {t('nav.workspace')} <span>/</span> <strong>{breadcrumbLabel}</strong>
        </div>
      </div>

      <div className="topbar-actions" ref={menuRef}>
        <LanguageSwitcher />

        <div className="topbar-menu-wrap">
          <button
            type="button"
            className="icon-button notification-button"
            onClick={() => {
              setNotificationsOpen((value) => !value);
              setProfileOpen(false);
            }}
            aria-label={t('topbar.notifications')}
            aria-expanded={notificationsOpen}
          >
            <Bell size={17} />
            {notificationCount > 0 && <span className="notification-dot" />}
          </button>

          {notificationsOpen && (
            <div className="topbar-popover notification-popover">
              <div className="popover-heading">{t('topbar.notifHeading')}</div>

              <button
                type="button"
                className="notification-item"
                onClick={() => openPage('inventory')}
              >
                <span className="notification-symbol warning">
                  <AlertTriangle size={17} />
                </span>
                <span className="notification-copy">
                  <strong>{t('topbar.lowStock')}</strong>
                  <small>
                    {lowStockCount > 0
                      ? t('topbar.lowStockMsg', { count: lowStockCount })
                      : t('topbar.lowStockNone')}
                  </small>
                </span>
                <Boxes size={16} />
              </button>

              <button
                type="button"
                className="notification-item"
                onClick={() => openPage('sales')}
              >
                <span className="notification-symbol credit">
                  <Wallet size={17} />
                </span>
                <span className="notification-copy">
                  <strong>{t('topbar.outstandingCredit')}</strong>
                  <small>
                    {outstandingSaleCount > 0
                      ? t('topbar.outstandingMsg', {
                          count: outstandingSaleCount,
                          amount: formatMinor(outstandingCreditMinor),
                        })
                      : t('topbar.outstandingNone')}
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
            aria-label={t('topbar.openProfile')}
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
                  <strong>{userName || fallbackName}</strong>
                  <small>{businessName || t('topbar.myBusiness')}</small>
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
                <Settings size={17} /> {t('topbar.settingsProfile')}
              </button>

              <button
                type="button"
                className="profile-menu-item signout-item"
                onClick={() => {
                  setProfileOpen(false);
                  onLogout?.();
                }}
              >
                <LogOut size={17} /> {t('topbar.signOut')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
