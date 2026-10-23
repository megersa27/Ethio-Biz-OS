import { useMemo } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Package,
  TrendingUp,
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

const salesData = [
  { day: 'Mon', sales: 3200, expenses: 1800 },
  { day: 'Tue', sales: 4600, expenses: 2500 },
  { day: 'Wed', sales: 3800, expenses: 2100 },
  { day: 'Thu', sales: 5900, expenses: 3200 },
  { day: 'Fri', sales: 4800, expenses: 2700 },
  { day: 'Sat', sales: 7200, expenses: 3900 },
  { day: 'Sun', sales: 6100, expenses: 3400 },
];

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

function SalesChart({ period, setPeriod, totalSalesMinor }) {
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
          <strong>{formatMinor(totalSalesMinor)}</strong>
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

function RecentSales({ sales, search, setActivePage, loading }) {
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
