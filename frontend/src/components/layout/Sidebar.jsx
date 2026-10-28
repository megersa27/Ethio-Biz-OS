import { useTranslation } from 'react-i18next';
import { Activity, ArrowRight, CircleHelp, Settings } from 'lucide-react';

function Sidebar({ navItems, activePage, setActivePage, isOpen, closeSidebar, lowStockCount = 0 }) {
  const { t } = useTranslation();

  return (
    <>
      {isOpen && <button className="sidebar-overlay" onClick={closeSidebar} aria-label={t('common.close')} />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Activity size={23} /></div>
          <div>
            <p className="brand-name">EthioBiz<span style={{ color: '#176b4d' }}> OS</span></p>
            <p className="brand-caption">{t('auth.headline1')}</p>
          </div>
        </div>

        <p className="nav-label">{t('nav.workspace')}</p>
        <nav className="nav-list" aria-label={t('nav.workspace')}>
          {navItems.map(({ id, labelKey, label, icon: Icon }) => {
            const pageId = id || label;
            const displayLabel = labelKey ? t(labelKey) : t(`nav.${pageId.toLowerCase()}`, { defaultValue: label });
            return (
              <button
                key={pageId}
                className={`nav-item ${activePage === pageId ? 'active' : ''}`}
                onClick={() => {
                  setActivePage(pageId);
                  closeSidebar();
                }}
              >
                <Icon size={18} strokeWidth={1.9} />
                <span>{displayLabel}</span>
                {pageId === 'Inventory' && lowStockCount > 0 && (
                  <span className="nav-count">{lowStockCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        <p className="nav-label nav-label-lower">{t('nav.preferences')}</p>
        <nav className="nav-list">
          <button
            className={`nav-item ${activePage === 'Settings' ? 'active' : ''}`}
            onClick={() => {
              setActivePage('Settings');
              closeSidebar();
            }}
          >
            <Settings size={18} strokeWidth={1.9} />
            <span>{t('nav.settings')}</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-card-icon"><CircleHelp size={18} /></div>
            <h3>{t('nav.needHand')}</h3>
            <p>{t('nav.helpBody')}</p>
            <button className="help-link" onClick={() => setActivePage('Help')}>
              {t('nav.visitHelp')} <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
