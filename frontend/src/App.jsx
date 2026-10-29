
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import HelpPage from './pages/HelpPage.jsx';
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
  { id: 'Dashboard', labelKey: 'nav.dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'Sales', labelKey: 'nav.sales', label: 'Sales', icon: ShoppingCart },
  { id: 'Products', labelKey: 'nav.products', label: 'Products', icon: Package },
  { id: 'Inventory', labelKey: 'nav.inventory', label: 'Inventory', icon: Boxes },
  { id: 'Customers', labelKey: 'nav.customers', label: 'Customers', icon: Users },
  { id: 'Expenses', labelKey: 'nav.expenses', label: 'Expenses', icon: CreditCard },
  { id: 'Reports', labelKey: 'nav.reports', label: 'Reports', icon: ClipboardList },
];

const VALID_PAGES = ['Dashboard', 'Sales', 'Products', 'Inventory', 'Customers', 'Expenses', 'Reports', 'Settings', 'Help'];
const ACTIVE_PAGE_STORAGE_KEY = 'ethioBiz.activePage';

function PlaceholderPage({ page, setActivePage }) {
  const { t } = useTranslation();
  const pageKey = page.toLowerCase();
  const description = t(`placeholder.${pageKey}`, {
    defaultValue: t('placeholder.default'),
  });

  const PageIcon = navItems.find((item) => item.id === page || item.label === page)?.icon || Settings;

  return (
    <section className="panel section-placeholder">
      <div>
        <div className="placeholder-icon"><PageIcon size={28} /></div>
        <h2>{t(`nav.${pageKey}`, { defaultValue: page })}</h2>
        <p>{description}</p>
        <p className="placeholder-note">{t('placeholder.note')}</p>
        <button className="primary-button" onClick={() => setActivePage('Dashboard')}>
          <LayoutDashboard size={16} /> {t('common.backToDashboard')}
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
  const { t } = useTranslation();
  const [activePage, setActivePage] = useState(() => {
    if (typeof window === 'undefined') return 'Dashboard';

    const savedPage = window.localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY);
    return VALID_PAGES.includes(savedPage) ? savedPage : 'Dashboard';
  });
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
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, activePage);
    }
  }, [activePage]);

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
        {t('common.loading')}
      </main>
    );
  }

  if (!auth) {
    return <AuthPage onLogin={login} />;
  }

  const salesStatLabel =
    period === 'Today'
      ? t('dashboard.salesToday')
      : period === 'This year'
      ? t('dashboard.salesYear')
      : t('dashboard.salesWeek');

  const expensesStatLabel =
    period === 'Today'
      ? t('dashboard.expensesToday')
      : period === 'This year'
      ? t('dashboard.expensesYear')
      : t('dashboard.expensesWeek');

  const profitStatLabel =
    period === 'Today'
      ? t('dashboard.profitToday')
      : period === 'This year'
      ? t('dashboard.profitYear')
      : t('dashboard.profitWeek');

  return (
    <div className="app-shell">
      <Sidebar
        navItems={navItems}
        activePage={activePage}
        setActivePage={setActivePage}
        isOpen={isSidebarOpen}
        closeSidebar={() => setIsSidebarOpen(false)}
        lowStockCount={lowStockItems.length}
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
                  <p className="eyebrow">{t('dashboard.eyebrow')}</p>
                  <h1>{t('dashboard.welcome', { name: auth.user?.name || t('dashboard.welcomeThere') })}</h1>
                  <p>{t('dashboard.today')}</p>
                </div>
                <div className="heading-actions">
                  <button className="secondary-button" onClick={() => window.print()}>
                    <Download size={15} /> {t('dashboard.export')}
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => setDashboardRefresh((value) => value + 1)}
                    disabled={dashboardLoading}
                  >
                    <RefreshCw size={16} />
                    {dashboardLoading ? t('common.refreshing') : t('dashboard.refreshData')}
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
                      ? t('dashboard.dataErrorLabel')
                      : dashboardLoading
                        ? t('dashboard.dataLoadingLabel')
                        : t('dashboard.dataLabel')}
                  </strong>{' '}
                  {dashboardError ||
                    (dashboardLoading
                      ? t('dashboard.dataLoading')
                      : t('dashboard.dataReady'))}
                </span>
              </div>

              <div className="stats-grid">
                <StatCard
                  label={salesStatLabel}
                  value={dashboardLoading && !dashboardSummary
                    ? t('common.loading')
                    : formatMinor(dashboardSummary?.totalSalesMinor ?? 0)}
                  change=""
                  note={t('dashboard.fromRecords')}
                  icon={Wallet}
                />
                <StatCard
                  label={expensesStatLabel}
                  value={dashboardLoading && !dashboardSummary
                    ? t('common.loading')
                    : formatMinor(dashboardSummary?.totalExpensesMinor ?? 0)}
                  change=""
                  note={t('dashboard.fromRecords')}
                  icon={CreditCard}
                  color="orange"
                />
                <StatCard
                  label={profitStatLabel}
                  value={dashboardLoading && !dashboardSummary
                    ? t('common.loading')
                    : formatMinor(dashboardSummary?.netProfitMinor ?? 0)}
                  change=""
                  note={t('dashboard.profitNote')}
                  icon={TrendingUp}
                  color="blue"
                />
                <StatCard
                  label={t('dashboard.creditOutstanding')}
                  value={dashboardLoading && !dashboardSummary
                    ? t('common.loading')
                    : formatMinor(dashboardSummary?.outstandingCreditMinor ?? 0)}
                  change=""
                  note={t('dashboard.outstandingSalesNote', { count: dashboardSummary?.outstandingSaleCount ?? 0 })}
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
                {t('dashboard.footer')}
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
                  <p className="eyebrow">{t('products.eyebrow')}</p>
                  <h1>{t('products.title')}</h1>
                  <p>{t('products.lead')}</p>
                </div>
                <button className="secondary-button" onClick={() => setActivePage('Dashboard')}>
                  <LayoutDashboard size={15} /> {t('common.dashboard')}
                </button>
              </div>
              <ProductsPage token={auth.accessToken} />
            </>
          ) : activePage === 'Inventory' ? (
            <InventoryPage token={auth.accessToken} />
          ) : activePage === 'Help' ? (
            <HelpPage
              onGoToDashboard={() => setActivePage('Dashboard')}
              onOpenSettings={() => setActivePage('Settings')}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">{t('nav.workspace')}</p>
                  <h1>{t(`nav.${activePage.toLowerCase()}`, { defaultValue: activePage })}</h1>
                  <p>{t('placeholder.default')}</p>
                </div>
                <button className="secondary-button" onClick={() => setActivePage('Dashboard')}>
                  <LayoutDashboard size={15} /> {t('common.dashboard')}
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
