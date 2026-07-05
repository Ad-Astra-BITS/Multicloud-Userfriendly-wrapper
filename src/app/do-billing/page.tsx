'use client';

/**
 * DO Billing Page (/do-billing)
 *
 * Month-to-date spend, account balance, and invoice history.
 * Equivalent to the AWS Cost Explorer analytics page.
 */

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useDO } from '@/context/DOContext';
import { doBillingApi, DOBillingHistory, DOInvoice } from '@/lib/doApi';
import {
  DollarSign, RefreshCw, TrendingDown, TrendingUp, Receipt,
  Loader2, WifiOff, Zap, Calendar, CreditCard,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

// ── Invoice Row ────────────────────────────────────────────────────────────

function InvoiceRow({ invoice }: { invoice: DOInvoice }) {
  const amount = parseFloat(invoice.amount);
  const [year, month] = invoice.invoicePeriod.split('-');
  const monthName = new Date(parseInt(year), parseInt(month) - 1, 1)
    .toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-700/30 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Receipt size={14} className="text-blue-400" />
        </div>
        <div>
          <p className="text-sm text-white font-medium">{monthName}</p>
          <p className="text-xs text-slate-500 font-mono">{invoice.invoiceUuid.slice(0, 8)}…</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-white">${parseFloat(invoice.amount).toFixed(2)}</p>
        <p className="text-xs text-slate-500">{new Date(invoice.updatedAt).toLocaleDateString()}</p>
      </div>
    </div>
  );
}

// ── Chart data helper ──────────────────────────────────────────────────────

function buildChartData(invoices: DOInvoice[]) {
  return [...invoices]
    .sort((a, b) => a.invoicePeriod.localeCompare(b.invoicePeriod))
    .slice(-6)
    .map((inv) => {
      const [y, m] = inv.invoicePeriod.split('-');
      const label = new Date(parseInt(y), parseInt(m) - 1, 1)
        .toLocaleString('en-US', { month: 'short' });
      return { month: label, cost: parseFloat(parseFloat(inv.amount).toFixed(2)) };
    });
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function DOBillingPage() {
  const { isConnected, openConnectModal } = useDO();
  const [billing, setBilling] = useState<DOBillingHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!isConnected) {
      setBilling(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    doBillingApi.history()
      .then(setBilling)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isConnected]);

  useEffect(() => { load(); }, [load]);

  const chartData = billing ? buildChartData(billing.invoices) : [];
  const latestInvoice = billing?.invoices[0];
  const prevInvoice = billing?.invoices[1];
  const change = latestInvoice && prevInvoice
    ? ((parseFloat(latestInvoice.amount) - parseFloat(prevInvoice.amount)) / parseFloat(prevInvoice.amount)) * 100
    : null;

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">DO Billing</h1>
          <p className="text-slate-400 mt-1">DigitalOcean invoice history and month-to-date spend</p>
        </div>
        <button onClick={load} disabled={loading || !isConnected} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {!isConnected && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <WifiOff size={40} className="text-slate-600 mb-4" />
          <p className="text-slate-500 text-sm mb-4">Connect your DigitalOcean account to view billing.</p>
          <button onClick={openConnectModal} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm transition-colors">
            <Zap size={14} /> Connect DigitalOcean
          </button>
        </div>
      )}

      {isConnected && loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
          <Loader2 size={20} className="animate-spin" /> Loading billing data…
        </div>
      )}

      {isConnected && error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
      )}

      {isConnected && billing && !loading && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <DollarSign size={18} className="text-blue-400" />
                </div>
                <p className="text-sm text-slate-400">Month-to-Date</p>
              </div>
              <p className="text-3xl font-bold text-white">${billing.monthToDate.toFixed(2)}</p>
              {change !== null && (
                <div className={`flex items-center gap-1 text-xs mt-2 ${change < 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {change < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                  {Math.abs(change).toFixed(1)}% vs last month
                </div>
              )}
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <CreditCard size={18} className="text-green-400" />
                </div>
                <p className="text-sm text-slate-400">Account Balance</p>
              </div>
              <p className={`text-3xl font-bold ${billing.accountBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${billing.accountBalance.toFixed(2)}
              </p>
              <p className="text-xs text-slate-500 mt-2">Credits &amp; pre-payments</p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Calendar size={18} className="text-purple-400" />
                </div>
                <p className="text-sm text-slate-400">Invoices on Record</p>
              </div>
              <p className="text-3xl font-bold text-white">{billing.invoices.length}</p>
              <p className="text-xs text-slate-500 mt-2">Most recent 12 months</p>
            </div>
          </div>

          {/* Spend bar chart */}
          {chartData.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-6">
              <h3 className="font-semibold text-white mb-4">Monthly Spend History</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(v) => [`$${Number(v ?? 0).toFixed(2)}`, 'Cost']}
                  />
                  <Bar dataKey="cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Invoice list */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4">Invoice History</h3>
            {billing.invoices.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No invoices found.</p>
            ) : (
              <div>
                {billing.invoices.map((inv) => (
                  <InvoiceRow key={inv.invoiceUuid} invoice={inv} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
