import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Package,
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
import { formatETB, formatMinor } from '../../utils/currency.js';
import { getSales, getExpenses } from '../../services/api.js';

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
        {change ? (
          <span className={direction === 'up' ? 'trend-up' : 'trend-down'}>
            <TrendIcon size={13} /> {change}
          </span>
        ) : null}
        <span>{note}</span>
      </div>
    </article>
  );
}


function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRecordDate(record, kind) {
  const raw = kind === 'expense'
    ? (record.date || record.createdAt)
    : (record.createdAt || record.date);

  if (!raw) return null;

  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return {
      key: raw,
      date: new Date(`${raw}T12:00:00`),
    };
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  return { key: localDateKey(date), date };
}

function getDateRange(period, now) {
  const today = localDateKey(now);
  let start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'This week') {
    const mondayOffset = (now.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
  } else if (period === 'This year') {
    start = new Date(now.getFullYear(), 0, 1);
  }

  return {
    startDate: localDateKey(start),
    endDate: today,
  };
}

function createChartBuckets(period, now) {
  if (period === 'Today') {
    const lastSlot = Math.floor(now.getHours() / 4);
    return Array.from({ length: lastSlot + 1 }, (_, index) => ({
      key: `hour-${index}`,
      label: `${String(index * 4).padStart(2, '0')}–${String(index * 4 + 3).padStart(2, '0')}`,
      salesMinor: 0,
      expensesMinor: 0,
    }));
  }

  if (period === 'This year') {
    return Array.from({ length: now.getMonth() + 1 }, (_, index) => ({
      key: `month-${now.getFullYear()}-${String(index + 1).padStart(2, '0')}`,
      label: new Date(now.getFullYear(), index, 1).toLocaleDateString('en-US', {
        month: 'short',
      }),
      salesMinor: 0,
      expensesMinor: 0,
    }));
  }

  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);

  return Array.from({ length: mondayOffset + 1 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return {
      key: localDateKey(day),
      label: day.toLocaleDateString('en-US', { weekday: 'short' }),
      salesMinor: 0,
      expensesMinor: 0,
    };
  });
}

function getRecordBucketKey(record, period, kind) {
  const parsed = getRecordDate(record, kind);
  if (!parsed) return null;

  if (period === 'Today') {
    return `hour-${Math.floor(parsed.date.getHours() / 4)}`;
  }

  if (period === 'This year') {
    return `month-${parsed.date.getFullYear()}-${String(parsed.date.getMonth() + 1).padStart(2, '0')}`;
  }

  return parsed.key;
}

async function fetchAllReportRows(loader, token, filters, key) {
  const first = await loader(token, {
    ...filters,
    page: 1,
    limit: 100,
  });

  const rows = Array.isArray(first?.[key]) ? first[key] : [];
  const reportedPages = Number(first?.pagination?.totalPages || 1);
  const totalPages = Math.max(1, Math.min(reportedPages, 100));

  if (totalPages === 1) return rows;

  const remaining = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      loader(token, {
        ...filters,
        page: index + 2,
        limit: 100,
      })
    )
  );

  return rows.concat(
    ...remaining.map((result) =>
      Array.isArray(result?.[key]) ? result[key] : []
    )
  );
}

function SalesChart({ period, setPeriod, token }) {
  const [chartData, setChartData] = useState([]);
  const [periodSalesMinor, setPeriodSalesMinor] = useState(0);
  const [periodExpensesMinor, setPeriodExpensesMinor] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasRecords, setHasRecords] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadChart() {
      setLoading(true);
      setError('');

      try {
        const now = new Date();
        const filters = getDateRange(period, now);

        const [salesRows, expenseRows] = await Promise.all([
          fetchAllReportRows(getSales, token, filters, 'sales'),
          fetchAllReportRows(getExpenses, token, filters, 'expenses'),
        ]);

        if (cancelled) return;

        const buckets = createChartBuckets(period, now);
        const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

        const validSales = salesRows.filter(
          (sale) => sale.saleStatus !== 'CANCELLED'
        );

        for (const sale of validSales) {
          const key = getRecordBucketKey(sale, period, 'sale');
          const bucket = bucketMap.get(key);
          if (bucket) bucket.salesMinor += Number(sale.totalAmountMinor || 0);
        }

        for (const expense of expenseRows) {
          const key = getRecordBucketKey(expense, period, 'expense');
          const bucket = bucketMap.get(key);
          if (bucket) bucket.expensesMinor += Number(expense.amountMinor || 0);
        }

        setPeriodSalesMinor(
          validSales.reduce((sum, sale) => sum + Number(sale.totalAmountMinor || 0), 0)
        );
        setPeriodExpensesMinor(
          expenseRows.reduce((sum, expense) => sum + Number(expense.amountMinor || 0), 0)
        );
        setHasRecords(validSales.length > 0 || expenseRows.length > 0);
        setChartData(buckets.map((bucket) => ({
          day: bucket.label,
          sales: bucket.salesMinor / 100,
          expenses: bucket.expensesMinor / 100,
        })));
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to load sales and expense trends.');
          setChartData([]);
          setHasRecords(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (token) loadChart();
    else {
      setError('Please sign in to view business trends.');
      setLoading(false);
    }

    return () => { cancelled = true; };
  }, [period, token]);

  return (
    <section className="panel chart-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Sales overview</h2>
          <p className="panel-subtitle">Sales and recorded expenses for the selected period</p>
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
          <span className="chart-summary-label">Sales in selected period</span>
          <strong>{loading ? 'Loading…' : formatMinor(periodSalesMinor)}</strong>
        </div>
        <span className="chart-period-summary">
          {period} · {loading ? 'updating' : 'business records'}
        </span>
      </div>

      <div className="chart-wrap">
        {loading ? (
          <p className="chart-message">Loading actual sales and expense records…</p>
        ) : error ? (
          <p className="chart-message chart-message-error">{error}</p>
        ) : !hasRecords ? (
          <p className="chart-message">No sales or expense records for this period yet.</p>
        ) : (
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
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#89958d', fontSize: 10 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#89958d', fontSize: 10 }}
                tickFormatter={(value) =>
                  value >= 1000
                    ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
                    : String(Math.round(value))
                }
              />
              <Tooltip
                formatter={(value, name) => [formatETB(Number(value)), name]}
                contentStyle={{ border: '1px solid #e8ede9', borderRadius: 10, fontSize: 11 }}
              />
              <Area
                type="monotone"
                dataKey="sales"
                name="Sales"
                stroke="#176b4d"
                strokeWidth={2.5}
                fill="url(#salesFill)"
                activeDot={{ r: 5 }}
              />
              <Area
                type="monotone"
                dataKey="expenses"
                name="Expenses"
                stroke="#a8d7bc"
                strokeWidth={2}
                fill="url(#expensesFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="chart-legend">
        <span className="legend-item"><span className="legend-dot" /> Sales</span>
        <span className="legend-item"><span className="legend-dotlight" /> Expenses</span>
        <span className="chart-expense-total">
          Expenses: {loading ? 'Loading…' : formatMinor(periodExpensesMinor)}
        </span>
      </div>
    </section>
  );
}


function StockAlerts({ items, setActivePage, loading }) {
  return (
    <section className="panel stock-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Low stock alerts</h2>
          <p className="panel-subtitle">Products that need attention</p>
        </div>
        <span className="alert-count">
          {loading ? '…' : items.length}
        </span>
      </div>

      <div className="stock-list">
        {items.map((item) => (
          <div className="stock-item" key={item.id}>
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

        {!loading && items.length === 0 && (
          <p className="empty-state">
            No low-stock products found.
          </p>
        )}

        {loading && (
          <p className="empty-state">Loading inventory…</p>
        )}
      </div>

      <div className="panel-footer">
        <button className="text-link" onClick={() => setActivePage('Inventory')}>
          View inventory <ArrowRight size={14} />
        </button>
      </div>
    </section>
  );
}

function RecentSales({ sales, search = '', setActivePage, loading }) {
  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return sales;

    return sales.filter((sale) =>
      `${sale.id} ${sale.customer} ${sale.status}`
        .toLowerCase()
        .includes(query)
    );
  }, [sales, search]);

  return (
    <section className="panel table-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Recent sales</h2>
          <p className="panel-subtitle">
            Your latest transactions from the backend
          </p>
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
                <td><strong>{formatMinor(sale.amountMinor)}</strong></td>
                <td>
                  <span className={`status ${sale.status.toLowerCase()}`}>
                    {sale.status}
                  </span>
                </td>
              </tr>
            ))}

            {filteredSales.length === 0 && (
              <tr>
                <td colSpan="5" className="empty-state">
                  {loading
                    ? 'Loading sales…'
                    : search
                      ? 'No matching sales found.'
                      : 'No sales recorded yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-bottom">
        <p>Showing {filteredSales.length} of {sales.length} transactions</p>
        <button className="text-link" onClick={() => setActivePage('Reports')}>
          Sales report <ArrowRight size={13} />
        </button>
      </div>
    </section>
  );
}

export { StatCard, SalesChart, StockAlerts, RecentSales };
