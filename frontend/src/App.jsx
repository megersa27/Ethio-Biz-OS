
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

export default function App() {
  const [activePage, setActivePage] = useState('Dashboard');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('This week');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sales, setSales] = useState([]);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [dashboardRefresh, setDashboardRefresh] = useState(0);
  const { auth, authChecking, login, logout } = useAuth();

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
            getDashboardSummary(token),
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
  }, [auth?.accessToken, dashboardRefresh]);

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
          search={search}
          setSearch={setSearch}
          onOpenMenu={() => setIsSidebarOpen(true)}
        />

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
                      : 'Figures are from your business records. The sales chart below still uses illustrative trends.')}
                </span>
              </div>

              <div className="stats-grid">
                <StatCard
                  label="Total sales"
                  value={dashboardLoading && !dashboardSummary
                    ? 'Loading…'
                    : formatMinor(dashboardSummary?.totalSalesMinor ?? 0)}
                  change=""
                  note="from business records"
                  icon={Wallet}
                />
                <StatCard
                  label="Total expenses"
                  value={dashboardLoading && !dashboardSummary
                    ? 'Loading…'
                    : formatMinor(dashboardSummary?.totalExpensesMinor ?? 0)}
                  change=""
                  note="from business records"
                  icon={CreditCard}
                  color="orange"
                />
                <StatCard
                  label="Net profit"
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
                  period={period}
                  setPeriod={setPeriod}
                  totalSalesMinor={dashboardSummary?.totalSalesMinor ?? 0}
                />
                <StockAlerts
                  items={lowStockItems}
                  loading={dashboardLoading}
                  setActivePage={setActivePage}
                />
              </div>

              <RecentSales
                sales={sales}
                search={search}
                loading={dashboardLoading}
                setActivePage={setActivePage}
              />

              <div className="footer-note">
                EthioBiz OS · Business insights made simple · Live business records
              </div>
            </>
          ) : activePage === 'Sales' ? (
            <SalesPage token={auth.accessToken} />
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
