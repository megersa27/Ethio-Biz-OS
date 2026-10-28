import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle, BarChart3, Boxes, CircleDollarSign,
  Download, RefreshCw, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react';
import {
  getBusinessReportSummary, getBusinessStockReport,
  getExpensesReport, getProfitReport, getSalesReport,
} from '../services/api.js';
import { formatMinor } from '../utils/currency.js';
import './ReportsPage.css';

// Local calendar date (YYYY-MM-DD). The target users are in Ethiopia, so the
// browser's local zone matches Africa/Addis_Ababa and stays consistent with the
// dashboard and sales pages. Using UTC here caused an off-by-one near midnight.
const today = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function Metric({ label, value, icon: Icon, tone = '' }) {
  return (
    <article className={`report-metric ${tone}`}>
      <div className="report-metric-top">
        <span>{label}</span><Icon size={19} />
      </div>
      <strong>{value}</strong>
    </article>
  );
}

export default function ReportsPage({ token }) {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(today());
  const [activeTab, setActiveTab] = useState('Overview');
  const [summary, setSummary] = useState(null);
  const [sales, setSales] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [profit, setProfit] = useState(null);
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError('');
    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    try {
      const results = await Promise.all([
        getBusinessReportSummary(token, filters),
        getSalesReport(token, filters),
        getExpensesReport(token, filters),
        getProfitReport(token, filters),
        getBusinessStockReport(token),
      ]);
      setSummary(results[0].report);
      setSales(results[1].report);
      setExpenses(results[2].report);
      setProfit(results[3].report);
      setStock(results[4].report);
    } catch (err) {
      setError(err.message || t('reports.errLoad'));
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate, t]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const money = (value) => formatMinor(Number(value || 0));
  const exportCsv = () => {
    if (!summary || !sales || !expenses || !profit || !stock) return;
    const rows = [
      ['EthioBiz OS - Business Reports'],
      ['Start date', startDate || 'All'],
      ['End date', endDate || 'All'],
      [],
      ['Metric', 'Value (ETB)'],
      ['Total sales', (sales.totalSalesMinor || 0) / 100],
      ['Cost of goods sold', (sales.costOfGoodsSoldMinor || 0) / 100],
      ['Gross profit', (profit.grossProfitMinor || 0) / 100],
      ['Total expenses', (expenses.totalExpensesMinor || 0) / 100],
      ['Net profit', (profit.netProfitMinor || 0) / 100],
      ['Payments collected', (sales.paymentsCollectedMinor || 0) / 100],
      ['Refunds', (sales.refundsIssuedMinor || 0) / 100],
      ['Outstanding credit', (summary.outstandingCreditMinor || 0) / 100],
      ['Active products', stock.totalProducts || 0],
      ['Low-stock products', stock.lowStockProducts || 0],
      [],
      ['Expense category', 'Amount (ETB)', 'Number of expenses'],
      ...(expenses.byCategory || []).map((row) => [
        row.category, (row.totalMinor || 0) / 100, row.count || 0,
      ]),
      [],
      ['Low stock item', 'Quantity', 'Minimum level'],
      ...(stock.lowStockItems || []).map((item) => [
        item.name, item.stockQuantity, item.minimumStockLevel,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) =>
      `"${String(cell ?? '').replace(/"/g, '""')}"`
    ).join(',')).join('\r\n');
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `ethiobiz-reports-${today()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: 'Overview', label: t('reports.tabOverview') },
    { id: 'Sales', label: t('reports.tabSales') },
    { id: 'Expenses', label: t('reports.tabExpenses') },
    { id: 'Profit', label: t('reports.tabProfit') },
    { id: 'Stock', label: t('reports.tabStock') },
  ];

  return (
    <section className="reports-page">
      <header className="reports-heading">
        <div>
          <p className="reports-eyebrow">{t('reports.eyebrow')}</p>
          <h1>{t('reports.title')}</h1>
          <p>{t('reports.lead')}</p>
        </div>
        <button className="reports-export" onClick={exportCsv} disabled={loading || !summary}>
          <Download size={16} /> {t('reports.exportCsv')}
        </button>
      </header>

      <div className="reports-filters">
        <label>
          <span>{t('reports.startDate')}</span>
          <input type="date" value={startDate} max={endDate || undefined}
            onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          <span>{t('reports.endDate')}</span>
          <input type="date" value={endDate} min={startDate || undefined}
            max={today()} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <button onClick={() => { setStartDate(''); setEndDate(today()); }}>
          {t('common.clearDates')}
        </button>
        <button onClick={loadReports} disabled={loading}>
          <RefreshCw size={15} /> {t('reports.refresh')}
        </button>
      </div>

      <nav className="reports-tabs" aria-label={t('reports.tabsAria')}>
        {tabs.map((tab) => (
          <button key={tab.id} className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
        ))}
      </nav>

      {error && (
        <div className="reports-error"><AlertCircle size={18} /><span>{error}</span>
          <button onClick={loadReports}>{t('common.retry')}</button>
        </div>
      )}

      {loading && !summary ? (
        <div className="reports-loading"><RefreshCw size={20} /> {t('reports.loadingReports')}</div>
      ) : (
        <>
          {activeTab === 'Overview' && (
            <>
              <div className="reports-metrics">
                <Metric label={t('reports.mTotalSales')} value={money(summary?.totalSalesMinor)} icon={CircleDollarSign} />
                <Metric label={t('reports.mGrossProfit')} value={money(summary?.grossProfitMinor)} icon={TrendingUp} tone="positive" />
                <Metric label={t('reports.mTotalExpenses')} value={money(summary?.totalExpensesMinor)} icon={TrendingDown} />
                <Metric label={t('reports.mNetProfit')} value={money(summary?.netProfitMinor)} icon={Wallet}
                  tone={(summary?.netProfitMinor || 0) >= 0 ? 'positive' : 'negative'} />
                <Metric label={t('reports.mOutstandingCredit')} value={money(summary?.outstandingCreditMinor)} icon={CircleDollarSign} />
                <Metric label={t('reports.mStockValue')} value={money(summary?.inventoryValueMinor)} icon={Boxes} />
              </div>
              <div className="reports-panel">
                <h2><BarChart3 size={19} /> {t('reports.overviewHeading')}</h2>
                <div className="reports-detail-grid">
                  <p>{t('reports.salesTransactions')} <strong>{summary?.salesCount ?? 0}</strong></p>
                  <p>{t('reports.paymentsCollected')} <strong>{money(summary?.paymentsCollectedMinor)}</strong></p>
                  <p>{t('reports.activeProducts')} <strong>{summary?.totalProducts ?? 0}</strong></p>
                  <p>{t('reports.lowStockProducts')} <strong>{summary?.lowStockProducts ?? 0}</strong></p>
                  <p>{t('reports.outstandingSales')} <strong>{summary?.outstandingSaleCount ?? 0}</strong></p>
                </div>
              </div>
            </>
          )}

          {activeTab === 'Sales' && (
            <div className="reports-panel">
              <h2>{t('reports.salesReportHeading')}</h2>
              <div className="reports-detail-grid">
                <p>{t('reports.mTotalSales')} <strong>{money(sales?.totalSalesMinor)}</strong></p>
                <p>{t('reports.salesTransactions')} <strong>{sales?.salesCount ?? 0}</strong></p>
                <p>{t('reports.costOfGoods')} <strong>{money(sales?.costOfGoodsSoldMinor)}</strong></p>
                <p>{t('reports.grossProfit')} <strong>{money(sales?.grossProfitMinor)}</strong></p>
                <p>{t('reports.paymentsCollected')} <strong>{money(sales?.paymentsCollectedMinor)}</strong></p>
                <p>{t('reports.netCollections')} <strong>{money(sales?.netCollectionsMinor)}</strong></p>
                <p>{t('reports.refundsIssued')} <strong>{money(sales?.refundsIssuedMinor)}</strong></p>
                <p>{t('reports.creditCreated')} <strong>{money(sales?.outstandingCreditForPeriodMinor)}</strong></p>
              </div>
            </div>
          )}

          {activeTab === 'Expenses' && (
            <div className="reports-panel">
              <h2>{t('reports.expensesByCatHeading')}</h2>
              <p className="reports-total">
                {t('reports.totalExpenses', { amount: money(expenses?.totalExpensesMinor), count: expenses?.expenseCount ?? 0 })}
              </p>
              {expenses?.byCategory?.length ? (
                <div className="reports-table-wrap"><table className="reports-table">
                  <thead><tr>
                    <th>{t('reports.thCategory')}</th>
                    <th>{t('reports.thRecords')}</th>
                    <th>{t('reports.thTotal')}</th>
                    <th>{t('reports.thShare')}</th>
                  </tr></thead>
                  <tbody>{expenses.byCategory.map((row) => {
                    const total = expenses.totalExpensesMinor || 0;
                    const share = total ? (row.totalMinor / total) * 100 : 0;
                    return <tr key={row.category}>
                      <td>{row.category}</td><td>{row.count}</td>
                      <td>{money(row.totalMinor)}</td><td>{share.toFixed(1)}%</td>
                    </tr>;
                  })}</tbody>
                </table></div>
              ) : <p className="reports-empty">{t('reports.noExpenses')}</p>}
            </div>
          )}

          {activeTab === 'Profit' && (
            <div className="reports-panel">
              <h2>{t('reports.profitHeading')}</h2>
              <div className="reports-detail-grid">
                <p>{t('reports.totalSales')} <strong>{money(profit?.totalSalesMinor)}</strong></p>
                <p>{t('reports.costOfGoods')} <strong>{money(profit?.costOfGoodsSoldMinor)}</strong></p>
                <p>{t('reports.grossProfit')} <strong>{money(profit?.grossProfitMinor)}</strong></p>
                <p>{t('reports.totalExpensesShort')} <strong>{money(profit?.totalExpensesMinor)}</strong></p>
                <p>{t('reports.netProfit')} <strong>{money(profit?.netProfitMinor)}</strong></p>
                <p>{t('reports.refundsIssued')} <strong>{money(profit?.refundsIssuedMinor)}</strong></p>
              </div>
              <p className="reports-note">{t('reports.profitNote')}</p>
            </div>
          )}

          {activeTab === 'Stock' && (
            <div className="reports-panel">
              <h2>{t('reports.inventoryHeading')}</h2>
              <div className="reports-detail-grid">
                <p>{t('reports.activeProducts')} <strong>{stock?.totalProducts ?? 0}</strong></p>
                <p>{t('reports.lowStockProducts')} <strong>{stock?.lowStockProducts ?? 0}</strong></p>
                <p>{t('reports.inventoryValue')} <strong>{money(stock?.inventoryValueMinor)}</strong></p>
              </div>
              <h3>{t('reports.lowStockItemsHeading')}</h3>
              {stock?.lowStockItems?.length ? (
                <div className="reports-table-wrap"><table className="reports-table">
                  <thead><tr>
                    <th>{t('reports.thProduct')}</th>
                    <th>{t('reports.thCurrentStock')}</th>
                    <th>{t('reports.thMinimumStock')}</th>
                  </tr></thead>
                  <tbody>{stock.lowStockItems.map((item) => (
                    <tr key={item._id || item.name}>
                      <td>{item.name}</td><td>{item.stockQuantity} {item.unit}</td>
                      <td>{item.minimumStockLevel} {item.unit}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              ) : <p className="reports-empty">{t('reports.noLowStock')}</p>}
            </div>
          )}
          <p className="reports-footnote">
            {t('reports.footnote', { start: startDate || t('reports.allDates'), end: endDate || t('reports.allDates') })}
          </p>
        </>
      )}
    </section>
  );
}
