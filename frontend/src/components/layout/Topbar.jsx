import { Bell, Menu, Search, X } from 'lucide-react';

export default function Topbar({ activePage, search, setSearch, onOpenMenu }) {
  return (
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              onClick={onOpenMenu}
              aria-label="Open navigation"
            >
              <Menu size={19} />
            </button>
            <div className="breadcrumb">Workspace <span>/</span> <strong>{activePage}</strong></div>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sales..."
                aria-label="Search sales"
              />
              {search && (
                <button className="clear-search" onClick={() => setSearch('')} aria-label="Clear search">
                  <X size={13} />
                </button>
              )}
            </label>
            <button className="icon-button notification-button" aria-label="Notifications">
              <Bell size={17} />
              <span className="notification-dot" />
            </button>
            <div className="avatar top-avatar">EB</div>
          </div>
        </header>
  );
}
