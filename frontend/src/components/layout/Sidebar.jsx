import { useTranslation } from 'react-i18next';
import { ArrowRight, CircleHelp, Settings } from 'lucide-react';
import logo from '../../assets/logo.png';

function Sidebar({ navItems, activePage, setActivePage, isOpen, closeSidebar, lowStockCount = 0 }) {
  const { t } = useTranslation();

  return (
    <>
      {isOpen && (
        <button
          className="sidebar-overlay"
          onClick={closeSidebar}
          aria-label={t('common.close')}
        />
      )}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <img src={logo} alt="EthioBiz OS" />
          </div>
          <div>
            <p className="brand-name">
              EthioBiz<span style={{ color: '#176b4d' }}> OS</span>
            </p>
            <p className="brand-caption">{t('nav.brandCaption')}</p>
          </div>
        </div>

        <p className="nav-label">{t('nav.workspace')}</p>
        <nav className="nav-list" aria-label={t('nav.workspace')}>
          {navItems.map(({ key, icon: Icon }) => (
            <button
              key={key}
              className={`nav-item ${activePage === key ? 'active' : ''}`}
              onClick={() => {
                setActivePage(key);
                closeSidebar();
              }}
            >
              <Icon size={18} strokeWidth={1.9} />
              <span>{t(`nav.${key}`)}</span>
              {key === 'inventory' && lowStockCount > 0 && (
                <span className="nav-count">{lowStockCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-card-icon"><CircleHelp size={18} /></div>
            <h3>{t('nav.needHand')}</h3>
            <p>{t('nav.helpBody')}</p>
            <button
              className="help-link"
              onClick={() => {
                setActivePage('help');
                closeSidebar();
              }}
            >
              {t('nav.visitHelp')} <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
