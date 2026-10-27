
import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Boxes,
  ClipboardList,
  CreditCard,
  Download,
  LayoutDashboard,
  Package,
  RefreshCw,
  Settings,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import './App.css';
import AuthPage from './pages/AuthPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import SalesPage from './pages/SalesPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import ExpensesPage from './pages/ExpensesPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { StatCard, SalesChart, StockAlerts, RecentSales } from './components/dashboard/DashboardWidgets.jsx';
import { formatMinor } from './utils/currency.js';
import Sidebar from './components/layout/Sidebar.jsx';
import Topbar from './components/layout/Topbar.jsx';
import {
  getDashboardSummary,
  getRecentSales,
  getCustomers,
} from './services/api.js';
import { useAuth } from './context/AuthContext.jsx';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Sales', icon: ShoppingCart },
  { label: 'Products', icon: Package },
  { label: 'Inventory', icon: Boxes },
  { label: 'Customers', icon: Users },
  { label: 'Expenses', icon: CreditCard },
  { label: 'Reports', icon: ClipboardList },
];

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


function getDashboardPeriodFilters(period, now = new Date()) {
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = new Date(end);

  if (period === 'This week') {
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
  } else if (period === 'This year') {
    start = new Date(now.getFullYear(), 0, 1);
  }

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
}

export default function App() {
  const [activePage, setActivePage] = useState('Dashboard');
  const [period, setPeriod] = useState('This week');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sales, setSales] = useState([]);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [dashboardRefresh, setDashboardRefresh] = useState(0);
  const { auth, authChecking, login, logout, updateProfile } = useAuth();

  useEffect(() => {
    const token = auth?.accessToken;

    if (!token) return undefined;

    let cancelled = false;

    async function loadDashboardData() {
      setDashboardLoading(true);
      setDashboardError('');

      try {
        const [summaryResult, salesResult, customersResult] =
          await Promise.all([
            getDashboardSummary(token, getDashboardPeriodFilters(period)),
            getRecentSales(token, 5),
            getCustomers(token),
          ]);

        if (cancelled) return;

        const summary = summaryResult.report || summaryResult;
        const customerRows = customersResult.customers || [];

        const customerNames = new Map(
          customerRows.map((customer) => [
            String(customer._id || customer.id),
            customer.name || 'Customer',
          ])
        );

        setDashboardSummary(summary);

        setLowStockItems(
          (summary.lowStockItems || []).map((item) => ({
            id: String(item._id || item.id || item.name),
            name: item.name,
            category: 'Below reorder level',
            quantity: item.stockQuantity,
            unit: item.unit || 'units',
            critical:
              Number(item.stockQuantity) <=
              Number(item.minimumStockLevel ?? 0),
          }))
        );

        setSales(
          (salesResult.sales || []).map((sale) => {
            const paymentStatus = String(sale.paymentStatus || '').toUpperCase();

            let status = 'Pending';
            if (sale.saleStatus === 'CANCELLED') {
              status = 'Cancelled';
            } else if (paymentStatus === 'PAID') {
              status = 'Paid';
            } else if (Number(sale.paidAmountMinor || 0) > 0) {
              status = 'Partial';
            }

            const rawCustomerId = sale.customerId?._id || sale.customerId;

            return {
              id: `SAL-${String(sale._id || sale.id).slice(-6).toUpperCase()}`,
              customer: rawCustomerId
                ? customerNames.get(String(rawCustomerId)) || 'Customer'
                : 'Walk-in customer',
              date: sale.createdAt
                ? new Date(sale.createdAt).toLocaleString('en-ET', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'Date unavailable',
              amountMinor: Number(sale.totalAmountMinor) || 0,
              status,
            };
          })
        );
      } catch (error) {
        if (!cancelled) {
          setDashboardError(error.message || 'Could not load dashboard data.');
        }
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    }

    loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, [auth?.accessToken, dashboardRefresh, period]);

  if (authChecking) {
    return (
      <main className="auth-session-checking">
        Checking your session...
      </main>
    );
  }

  if (!auth) {
    return <AuthPage onLogin={login} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        navItems={navItems}
        activePage={activePage}
        setActivePage={setActivePage}
        isOpen={isSidebarOpen}
        closeSidebar={() => setIsSidebarOpen(false)}
        businessName={auth.business?.name}
        userName={auth.user?.name}
        onLogout={logout}
      />

      <main className="main-area">
        <Topbar
          activePage={activePage}
          onOpenMenu={() => setIsSidebarOpen(true)}
          onNavigate={setActivePage}
          userName={auth.user?.name}
          businessName={auth.business?.name}
          onSettings={() => setActivePage('Settings')}
          onLogout={logout}
          recentSales={sales}
          lowStockItems={lowStockItems}
          outstandingCreditMinor={dashboardSummary?.outstandingCreditMinor ?? 0}
          outstandingSaleCount={dashboardSummary?.outstandingSaleCount ?? 0}
        />

        <div className="content">
          {activePage === 'Dashboard' ? (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">BUSINESS AT A GLANCE</p>
                  <h1>Welcome back, {auth.user?.name || 'there'} 👋</h1>
                  <p>Here’s what’s happening with your business today.</p>
                </div>
                <div className="heading-actions">
                  <button className="secondary-button" onClick={() => window.print()}>
                    <Download size={15} /> Export
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => setDashboardRefresh((value) => value + 1)}
                    disabled={dashboardLoading}
                  >
                    <RefreshCw size={16} />
                    {dashboardLoading ? 'Refreshing…' : 'Refresh data'}
                  </button>
                </div>
              </div>

              <div className="demo-notice">
                {dashboardError
                  ? <AlertTriangle size={16} />
                  : <Activity size={16} />}
                <span>
                  <strong>
                    {dashboardError
                      ? 'Could not load live data:'
                      : dashboardLoading
                        ? 'Loading business data:'
                        : 'Business data:'}
                  </strong>{' '}
                  {dashboardError ||
                    (dashboardLoading
                      ? 'Fetching sales, expenses, credit and inventory.'
                      : 'Sales, expenses and profit follow the selected period. Credit and stock alerts show current status; the chart uses recorded sales and expenses.')}
                </span>
              </div>

              <div className="stats-grid">
                <StatCard
                  label={period === 'Today' ? "Today's sales" : period === 'This year' ? 'Sales this year' : 'Sales this week'}
                  value={dashboardLoading && !dashboardSummary
                    ? 'Loading…'
                    : formatMinor(dashboardSummary?.totalSalesMinor ?? 0)}
                  change=""
                  note="from business records"
                  icon={Wallet}
                />
                <StatCard
                  label={period === 'Today' ? "Today's expenses" : period === 'This year' ? 'Expenses this year' : 'Expenses this week'}
                  value={dashboardLoading && !dashboardSummary
                    ? 'Loading…'
                    : formatMinor(dashboardSummary?.totalExpensesMinor ?? 0)}
                  change=""
                  note="from business records"
                  icon={CreditCard}
                  color="orange"
                />
                <StatCard
                  label={period === 'Today' ? "Today's net profit" : period === 'This year' ? 'Net profit this year' : 'Net profit this week'}
                  value={dashboardLoading && !dashboardSummary
                    ? 'Loading…'
                    : formatMinor(dashboardSummary?.netProfitMinor ?? 0)}
                  change=""
                  note="sales profit minus expenses"
                  icon={TrendingUp}
                  color="blue"
                />
                <StatCard
                  label="Credit outstanding"
                  value={dashboardLoading && !dashboardSummary
                    ? 'Loading…'
                    : formatMinor(dashboardSummary?.outstandingCreditMinor ?? 0)}
                  change=""
                  note={`${dashboardSummary?.outstandingSaleCount ?? 0} outstanding sales`}
                  icon={Users}
                  color="purple"
                />
              </div>

                            <div className="dashboard-grid">
                <SalesChart
                  token={auth.accessToken}
                  period={period}
                  setPeriod={setPeriod}
                />
                <StockAlerts
                  items={lowStockItems}
                  loading={dashboardLoading}
                  setActivePage={setActivePage}
                />
              </div>

              <RecentSales
                sales={sales}
                      loading={dashboardLoading}
                setActivePage={setActivePage}
              />

              <div className="footer-note">
                EthioBiz OS · Business insights made simple · Live business records
              </div>
            </>
          ) : activePage === 'Sales' ? (
            <SalesPage token={auth.accessToken} />
          ) : activePage === 'Settings' ? (
            <SettingsPage token={auth.accessToken} onProfileUpdated={updateProfile} />
          ) : activePage === 'Reports' ? (
            <ReportsPage token={auth.accessToken} />
          ) : activePage === 'Expenses' ? (
            <ExpensesPage token={auth.accessToken} />
          ) : activePage === 'Customers' ? (
            <CustomersPage token={auth.accessToken} />
          ) : activePage === 'Products' ? (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">YOUR BUSINESS WORKSPACE</p>
                  <h1>Products</h1>
                  <p>Manage product details, prices and reorder levels.</p>
                </div>
                <button className="secondary-button" onClick={() => setActivePage('Dashboard')}>
                  <LayoutDashboard size={15} /> Dashboard
                </button>
              </div>
              <ProductsPage token={auth.accessToken} />
            </>
          ) : activePage === 'Inventory' ? (
            <InventoryPage token={auth.accessToken} />
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
