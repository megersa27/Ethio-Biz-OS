import { Activity, ArrowRight, CircleHelp, Settings } from 'lucide-react';

function Sidebar({ navItems, activePage, setActivePage, isOpen, closeSidebar }) {
  return (
    <>
      {isOpen && <button className="sidebar-overlay" onClick={closeSidebar} aria-label="Close menu" />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Activity size={23} /></div>
          <div>
            <p className="brand-name">EthioBiz<span style={{ color: '#176b4d' }}> OS</span></p>
            <p className="brand-caption">Business management made simple</p>
          </div>
        </div>

        <p className="nav-label">Workspace</p>
        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${activePage === label ? 'active' : ''}`}
              onClick={() => {
                setActivePage(label);
                closeSidebar();
              }}
            >
              <Icon size={18} strokeWidth={1.9} />
              <span>{label}</span>
              {label === 'Inventory' && <span className="nav-count">4</span>}
            </button>
          ))}
        </nav>

        <p className="nav-label nav-label-lower">Preferences</p>
        <nav className="nav-list">
          <button
            className={`nav-item ${activePage === 'Settings' ? 'active' : ''}`}
            onClick={() => {
              setActivePage('Settings');
              closeSidebar();
            }}
          >
            <Settings size={18} strokeWidth={1.9} />
            <span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-card-icon"><CircleHelp size={18} /></div>
            <h3>Need a hand?</h3>
            <p>Find help to get the most out of your business workspace.</p>
            <button className="help-link" onClick={() => setActivePage('Help')}>
              Visit help center <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
