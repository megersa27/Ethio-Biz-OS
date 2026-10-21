
import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Boxes,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  CreditCard,
  Download,
  LayoutDashboard,
  Menu,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './App.css';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Sales', icon: ShoppingCart },
  { label: 'Products', icon: Package },
  { label: 'Inventory', icon: Boxes },
  { label: 'Customers', icon: Users },
  { label: 'Expenses', icon: CreditCard },
  { label: 'Reports', icon: ClipboardList },
];

const salesData = [
  { day: 'Mon', sales: 3200, expenses: 1800 },
  { day: 'Tue', sales: 4600, expenses: 2500 },
  { day: 'Wed', sales: 3800, expenses: 2100 },
  { day: 'Thu', sales: 5900, expenses: 3200 },
  { day: 'Fri', sales: 4800, expenses: 2700 },
  { day: 'Sat', sales: 7200, expenses: 3900 },
  { day: 'Sun', sales: 6100, expenses: 3400 },
];

const initialSales = [
  { id: 'SAL-2048', customer: 'Abebe Kebede', date: 'Today, 10:42 AM', amount: 2450, status: 'Paid' },
  { id: 'SAL-2047', customer: 'Hana Tesfaye', date: 'Today, 09:18 AM', amount: 1870, status: 'Paid' },
  { id: 'SAL-2046', customer: 'Mohammed Ali', date: 'Today, 08:56 AM', amount: 3200, status: 'Pending' },
  { id: 'SAL-2045', customer: 'Sara Bekele', date: 'Yesterday', amount: 950, status: 'Paid' },
  { id: 'SAL-2044', customer: 'Dawit Alemu', date: 'Yesterday', amount: 1420, status: 'Pending' },
];

const stockItems = [
  { name: 'Cooking Oil 5L', category: 'Groceries', quantity: 4, unit: 'units', critical: true },
  { name: 'Sugar 1kg', category: 'Groceries', quantity: 7, unit: 'packs', critical: false },
  { name: 'Laundry Soap', category: 'Household', quantity: 3, unit: 'pieces', critical: true },
  { name: 'Flour 25kg', category: 'Groceries', quantity: 6, unit: 'bags', critical: false },
];

const formatETB = (amount) =>
  new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    maximumFractionDigits: 0,
  }).format(amount);

function Sidebar({ activePage, setActivePage, isOpen, closeSidebar }) {
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
          <div className="profile-mini">
            <div className="avatar">EB</div>
            <div className="profile-copy">
              <p className="profile-name">My Business</p>
              <p className="profile-role">Business owner</p>
            </div>
            <button className="profile-more" aria-label="Profile options">
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function StatCard({ label, value, change, note, icon: Icon, color, direction = 'up' }) {
  const TrendIcon = direction === 'up' ? ArrowUpRight : ArrowDownRight;
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className={`stat-icon ${color || ''}`}><Icon size={19} /></span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-footer">
        <span className={direction === 'up' ? 'trend-up' : 'trend-down'}>
          <TrendIcon size={13} /> {change}
        </span>
        <span>{note}</span>
      </div>
    </article>
  );
}

function SalesChart({ period, setPeriod }) {
  const chartData = period === 'Today'
    ? salesData.slice(0, 5)
    : period === 'This year'
      ? salesData.map((item, index) => ({
          ...item,
          day: ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov', 'Dec'][index],
          sales: item.sales * 4,
          expenses: item.expenses * 3,
        }))
      : salesData;

  return (
    <section className="panel chart-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Sales overview</h2>
          <p className="panel-subtitle">Track your business performance</p>
        </div>
        <select
          className="select-control"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
          aria-label="Sales chart period"
        >
          <option>This week</option>
          <option>Today</option>
          <option>This year</option>
        </select>
      </div>

      <div className="chart-summary">
        <div>
          <span className="chart-summary-label">Total sales</span>
          <strong>ETB 35,600</strong>
        </div>
        <span className="chart-change"><TrendingUp size={14} /> 12.8%</span>
      </div>

      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 4, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#176b4d" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#176b4d" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="expensesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a8d7bc" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#a8d7bc" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#edf1ed" strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#89958d', fontSize: 10 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#89958d', fontSize: 10 }} tickFormatter={(value) => `${value / 1000}k`} />
            <Tooltip
              formatter={(value) => [formatETB(value), '']}
              contentStyle={{ border: '1px solid #e8ede9', borderRadius: 10, fontSize: 11 }}
            />
            <Area type="monotone" dataKey="sales" name="Sales" stroke="#176b4d" strokeWidth={2.5} fill="url(#salesFill)" activeDot={{ r: 5 }} />
            <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#a8d7bc" strokeWidth={2} fill="url(#expensesFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-legend">
        <span className="legend-item"><span className="legend-dot" /> Sales</span>
        <span className="legend-item"><span className="legend-dot light" /> Expenses</span>
      </div>
    </section>
  );
}

function StockAlerts({ setActivePage }) {
  return (
    <section className="panel stock-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Low stock alerts</h2>
          <p className="panel-subtitle">Products that need attention</p>
        </div>
        <span className="alert-count">{stockItems.length}</span>
      </div>

      <div className="stock-list">
        {stockItems.map((item) => (
          <div className="stock-item" key={item.name}>
            <div className="stock-avatar"><Package size={18} /></div>
            <div className="stock-info">
              <p className="stock-name">{item.name}</p>
              <p className="stock-meta">{item.category}</p>
            </div>
            <span className={`stock-count ${item.critical ? 'critical' : ''}`}>
              {item.quantity} {item.unit}
            </span>
          </div>
        ))}
      </div>

      <div className="panel-footer">
        <button className="text-link" onClick={() => setActivePage('Inventory')}>
          View inventory <ArrowRight size={14} />
        </button>
      </div>
    </section>
  );
}

function RecentSales({ sales, search, setActivePage }) {
  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sales;
    return sales.filter((sale) =>
      `${sale.id} ${sale.customer} ${sale.status}`.toLowerCase().includes(query)
    );
  }, [sales, search]);

  return (
    <section className="panel table-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Recent sales</h2>
          <p className="panel-subtitle">A quick look at your latest transactions</p>
        </div>
        <button className="secondary-button" onClick={() => setActivePage('Sales')}>
          View all <ArrowRight size={14} />
        </button>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Sale ID</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.map((sale) => (
              <tr key={sale.id}>
                <td><span className="table-primary">{sale.id}</span></td>
                <td>{sale.customer}</td>
                <td><span className="table-secondary">{sale.date}</span></td>
                <td><strong>{formatETB(sale.amount)}</strong></td>
                <td><span className={`status ${sale.status.toLowerCase()}`}>{sale.status}</span></td>
              </tr>
            ))}
            {filteredSales.length === 0 && (
              <tr><td colSpan="5" className="empty-state">No matching sales found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-bottom">
        <p>Showing {filteredSales.length} of {sales.length} demo transactions</p>
        <button className="text-link" onClick={() => setActivePage('Reports')}>
          Sales report <ArrowRight size={13} />
        </button>
      </div>
    </section>
  );
}

function PlaceholderPage({ page, setActivePage }) {
  const descriptions = {
    Sales: 'Record sales, review transactions, and keep track of payments from your customers.',
    Products: 'Organize your products, prices, and categories in one place.',
    Inventory: 'Monitor stock levels and find products that need restocking.',
    Customers: 'Manage customer details, purchase history, and outstanding credit.',
    Expenses: 'Record business expenses and understand where your money goes.',
    Reports: 'Review sales, expenses, profit, and business performance.',
    Settings: 'Manage your business profile and workspace preferences.',
    Help: 'Find guidance and support for using your business workspace.',
  };

  const PageIcon = navItems.find((item) => item.label === page)?.icon || Settings;

  return (
    <section className="panel section-placeholder">
      <div>
        <div className="placeholder-icon"><PageIcon size={28} /></div>
        <h2>{page}</h2>
        <p>{descriptions[page] || 'Manage your business in one convenient workspace.'}</p>
        <p className="placeholder-note">This section is part of the frontend foundation. We will connect it to your existing backend in the next steps.</p>
        <button className="primary-button" onClick={() => setActivePage('Dashboard')}>
          <LayoutDashboard size={16} /> Back to dashboard
        </button>
      </div>
    </section>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState('Dashboard');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('This week');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sales, setSales] = useState(initialSales);

  const addDemoSale = () => {
    const nextNumber = 2049 + sales.length - initialSales.length;
    const newSale = {
      id: `SAL-${nextNumber}`,
      customer: 'New customer',
      date: 'Just now',
      amount: 1250,
      status: 'Paid',
    };
    setSales((current) => [newSale, ...current]);
  };

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        isOpen={isSidebarOpen}
        closeSidebar={() => setIsSidebarOpen(false)}
      />

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              onClick={() => setIsSidebarOpen(true)}
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

        <div className="content">
          {activePage === 'Dashboard' ? (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">BUSINESS AT A GLANCE</p>
                  <h1>Good morning 👋</h1>
                  <p>Here’s what’s happening with your business today.</p>
                </div>
                <div className="heading-actions">
                  <button className="secondary-button" onClick={() => window.print()}>
                    <Download size={15} /> Export
                  </button>
                  <button className="primary-button" onClick={addDemoSale}>
                    <Plus size={16} /> Add demo sale
                  </button>
                </div>
              </div>

              <div className="demo-notice">
                <AlertTriangle size={16} />
                <span><strong>Preview mode:</strong> These are sample figures for demonstrating the dashboard, not your actual business records.</span>
              </div>

              <div className="stats-grid">
                <StatCard
                  label="Total sales"
                  value="ETB 35,600"
                  change="12.8%"
                  note="vs. previous period"
                  icon={Wallet}
                  color=""
                />
                <StatCard
                  label="Total expenses"
                  value="ETB 12,450"
                  change="4.3%"
                  note="vs. previous period"
                  icon={CreditCard}
                  color="orange"
                  direction="down"
                />
                <StatCard
                  label="Net profit"
                  value="ETB 23,150"
                  change="8.6%"
                  note="vs. previous period"
                  icon={TrendingUp}
                  color="blue"
                />
                <StatCard
                  label="Credit outstanding"
                  value="ETB 8,200"
                  change="3 customers"
                  note="need follow-up"
                  icon={Users}
                  color="purple"
                  direction="down"
                />
              </div>

              <div className="dashboard-grid">
                <SalesChart period={period} setPeriod={setPeriod} />
                <StockAlerts setActivePage={setActivePage} />
              </div>

              <RecentSales sales={sales} search={search} setActivePage={setActivePage} />

              <div className="footer-note">
                EthioBiz OS · Business insights made simple · Demo data
              </div>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">YOUR BUSINESS WORKSPACE</p>
                  <h1>{activePage}</h1>
                  <p>Everything you need to manage your business in one place.</p>
                </div>
                <button className="secondary-button" onClick={() => setActivePage('Dashboard')}>
                  <LayoutDashboard size={15} /> Dashboard
                </button>
              </div>
              <PlaceholderPage page={activePage} setActivePage={setActivePage} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
