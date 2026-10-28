import { useCallback, useEffect, useState } from 'react';
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
      setError(err.message || 'Gabaasa fe’uun hin danda’amne.');
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate]);

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

  const tabs = ['Overview', 'Sales', 'Expenses', 'Profit', 'Stock'];

  return (
    <section className="reports-page">
      <header className="reports-heading">
        <div>
          <p className="reports-eyebrow">BUSINESS PERFORMANCE</p>
          <h1>Reports &amp; Analytics</h1>
          <p>Review sales, expenses, profit and inventory from your business records.</p>
        </div>
        <button className="reports-export" onClick={exportCsv} disabled={loading || !summary}>
          <Download size={16} /> Export CSV
        </button>
      </header>

      <div className="reports-filters">
        <label>
          <span>Start date</span>
          <input type="date" value={startDate} max={endDate || undefined}
            onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          <span>End date</span>
          <input type="date" value={endDate} min={startDate || undefined}
            max={today()} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <button onClick={() => { setStartDate(''); setEndDate(today()); }}>
          Clear dates
        </button>
        <button onClick={loadReports} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <nav className="reports-tabs" aria-label="Report categories">
        {tabs.map((tab) => (
          <button key={tab} className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </nav>

      {error && (
        <div className="reports-error"><AlertCircle size={18} /><span>{error}</span>
          <button onClick={loadReports}>Try again</button>
        </div>
      )}

      {loading && !summary ? (
        <div className="reports-loading"><RefreshCw size={20} /> Loading reports…</div>
      ) : (
        <>
          {activeTab === 'Overview' && (
            <>
              <div className="reports-metrics">
                <Metric label="Total sales" value={money(summary?.totalSalesMinor)} icon={CircleDollarSign} />
                <Metric label="Gross profit" value={money(summary?.grossProfitMinor)} icon={TrendingUp} tone="positive" />
                <Metric label="Total expenses" value={money(summary?.totalExpensesMinor)} icon={TrendingDown} />
                <Metric label="Net profit" value={money(summary?.netProfitMinor)} icon={Wallet}
                  tone={(summary?.netProfitMinor || 0) >= 0 ? 'positive' : 'negative'} />
                <Metric label="Outstanding credit" value={money(summary?.outstandingCreditMinor)} icon={CircleDollarSign} />
                <Metric label="Stock value" value={money(summary?.inventoryValueMinor)} icon={Boxes} />
              </div>
              <div className="reports-panel">
                <h2><BarChart3 size={19} /> Business overview</h2>
                <div className="reports-detail-grid">
                  <p>Sales transactions <strong>{summary?.salesCount ?? 0}</strong></p>
                  <p>Payments collected <strong>{money(summary?.paymentsCollectedMinor)}</strong></p>
                  <p>Active products <strong>{summary?.totalProducts ?? 0}</strong></p>
                  <p>Low-stock products <strong>{summary?.lowStockProducts ?? 0}</strong></p>
                  <p>Outstanding sales <strong>{summary?.outstandingSaleCount ?? 0}</strong></p>
                </div>
              </div>
            </>
          )}

          {activeTab === 'Sales' && (
            <div className="reports-panel">
              <h2>Sales report</h2>
              <div className="reports-detail-grid">
                <p>Total sales <strong>{money(sales?.totalSalesMinor)}</strong></p>
                <p>Sales transactions <strong>{sales?.salesCount ?? 0}</strong></p>
                <p>Cost of goods sold <strong>{money(sales?.costOfGoodsSoldMinor)}</strong></p>
                <p>Gross profit <strong>{money(sales?.grossProfitMinor)}</strong></p>
                <p>Payments collected <strong>{money(sales?.paymentsCollectedMinor)}</strong></p>
                <p>Net collections after refunds <strong>{money(sales?.netCollectionsMinor)}</strong></p>
                <p>Refunds issued <strong>{money(sales?.refundsIssuedMinor)}</strong></p>
                <p>Credit created during period <strong>{money(sales?.outstandingCreditForPeriodMinor)}</strong></p>
              </div>
            </div>
          )}

          {activeTab === 'Expenses' && (
            <div className="reports-panel">
              <h2>Expenses by category</h2>
              <p className="reports-total">Total expenses: <strong>{money(expenses?.totalExpensesMinor)}</strong>
                {' '}· {expenses?.expenseCount ?? 0} records</p>
              {expenses?.byCategory?.length ? (
                <div className="reports-table-wrap"><table className="reports-table">
                  <thead><tr><th>Category</th><th>Records</th><th>Total</th><th>Share</th></tr></thead>
                  <tbody>{expenses.byCategory.map((row) => {
                    const total = expenses.totalExpensesMinor || 0;
                    const share = total ? (row.totalMinor / total) * 100 : 0;
                    return <tr key={row.category}>
                      <td>{row.category}</td><td>{row.count}</td>
                      <td>{money(row.totalMinor)}</td><td>{share.toFixed(1)}%</td>
                    </tr>;
                  })}</tbody>
                </table></div>
              ) : <p className="reports-empty">No expenses found for this period.</p>}
            </div>
          )}

          {activeTab === 'Profit' && (
            <div className="reports-panel">
              <h2>Profit report</h2>
              <div className="reports-detail-grid">
                <p>Total sales <strong>{money(profit?.totalSalesMinor)}</strong></p>
                <p>Cost of goods sold <strong>{money(profit?.costOfGoodsSoldMinor)}</strong></p>
                <p>Gross profit <strong>{money(profit?.grossProfitMinor)}</strong></p>
                <p>Total expenses <strong>{money(profit?.totalExpensesMinor)}</strong></p>
                <p>Net profit <strong>{money(profit?.netProfitMinor)}</strong></p>
                <p>Refunds issued <strong>{money(profit?.refundsIssuedMinor)}</strong></p>
              </div>
              <p className="reports-note">Net profit here is calculated by the backend as gross profit minus recorded expenses.</p>
            </div>
          )}

          {activeTab === 'Stock' && (
            <div className="reports-panel">
              <h2>Inventory health</h2>
              <div className="reports-detail-grid">
                <p>Active products <strong>{stock?.totalProducts ?? 0}</strong></p>
                <p>Low-stock products <strong>{stock?.lowStockProducts ?? 0}</strong></p>
                <p>Inventory value at cost <strong>{money(stock?.inventoryValueMinor)}</strong></p>
              </div>
              <h3>Low-stock items</h3>
              {stock?.lowStockItems?.length ? (
                <div className="reports-table-wrap"><table className="reports-table">
                  <thead><tr><th>Product</th><th>Current stock</th><th>Minimum stock</th></tr></thead>
                  <tbody>{stock.lowStockItems.map((item) => (
                    <tr key={item._id || item.name}>
                      <td>{item.name}</td><td>{item.stockQuantity} {item.unit}</td>
                      <td>{item.minimumStockLevel} {item.unit}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              ) : <p className="reports-empty">No low-stock items reported.</p>}
            </div>
          )}
          <p className="reports-footnote">
            Report period: {startDate || 'All dates'} to {endDate || 'All dates'}.
            Stock is a current snapshot, not a historical stock balance.
          </p>
        </>
      )}
    </section>
  );
}
